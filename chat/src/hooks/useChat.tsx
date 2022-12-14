import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import debounce from "lodash.debounce";
import { useRootContext } from "./useRootContext";
import { useWindowFocus } from "./useWindowFocus";

enum ChatHandlers {
  CONNECT = "connect",
  CATCHUP = "catchup",
  ONLINE = "online",
  TYPING = "typing",
  DELETE = "delete",
  SPEAK = "speak",
}

interface UserToDM {
  id: string;
  username: string;
}

interface ChatProviderContext {
  online: string[];
  typing: string[];
  messages: IChatMessage[];
  draft: string;
  quote: null | IChatMessage;
  messageLookup: Record<string, IChatMessage>;
  userToDm: null | UserToDM;
  updateDraft: React.Dispatch<React.SetStateAction<string>>;
  sendMessage(): void;
  quoteMessage(message: null | IChatMessage): void;
  deleteMessage(withText: string): void;
  updateUserToDm(userToDm: UserToDM): void;
}

const ChatContext = createContext<ChatProviderContext>({
  online: [],
  typing: [],
  messages: [],
  draft: "",
  quote: null,
  messageLookup: {},
  userToDm: null,
  updateDraft() {},
  sendMessage() {},
  quoteMessage() {},
  deleteMessage() {},
  updateUserToDm() {},
});

const MINIMUM_TYPING_UPDATE_INTERVAL = 250;
export const DIRECT_MESSAGE_ID = "DIRECT_MESSAGE";
export const OPTIMISTIC_MESSAGE_ID = "OPTIMISTIC";

export function ChatProvider({ children }: PropsWithChildren) {
  const { username, id, siteName, hat, avatar, nameColor } = useRootContext();
  const socket = useRef<null | Socket>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const lastDraft = useRef("");
  const [quote, setQuote] = useState<null | IChatMessage>(null);
  const focused = useWindowFocus();
  const [userToDm, setUserToDm] = useState<null | UserToDM>(null);
  const [notifications, setNotifications] = useState<number>(0);
  const [messageLookup, setMessageLookup] = useState({});
  const addMessage = useCallback((message: IChatMessage) => {
    if (message.id === OPTIMISTIC_MESSAGE_ID) {
      setMessages((prev) => prev.concat(message));
    } else {
      // Are there any optimistic messages that have the same text?
      setMessages((prev) => {
        const matchingOptimisticMessage = prev.findIndex(
          (prevMessage) =>
            prevMessage.id === OPTIMISTIC_MESSAGE_ID &&
            prevMessage.text.trim() === message.text.trim()
        );

        if (matchingOptimisticMessage === -1) {
          return prev.slice(-99).concat(message);
        } else {
          const before = prev.slice(0, matchingOptimisticMessage);
          const after = prev.slice(matchingOptimisticMessage + 1);

          return [...before, message, ...after];
        }
      });
    }

    if (message.username !== username && !document.hasFocus()) {
      setNotifications((prev) => prev + 1);
    }
  }, []);
  const sendMessage = useCallback(() => {
    if (userToDm) {
      const directMessage = `<small class="text-primary"><em>(Sent to @${userToDm.username}):</em></small> ${draft}`;

      addMessage({
        id: DIRECT_MESSAGE_ID,
        username,
        user_id: id,
        avatar,
        hat,
        namecolor: nameColor,
        text: directMessage,
        base_text_censored: directMessage,
        text_censored: directMessage,
        text_html: directMessage,
        time: new Date().getTime() / 1000,
        quotes: null,
        dm: true,
      });
    } else {
      addMessage({
        id: OPTIMISTIC_MESSAGE_ID,
        username,
        user_id: id,
        avatar,
        hat,
        namecolor: nameColor,
        text: draft,
        base_text_censored: draft,
        text_censored: draft,
        text_html: draft,
        time: new Date().getTime() / 1000,
        quotes: null,
        dm: false,
      });
    }

    socket.current?.emit(ChatHandlers.SPEAK, {
      message: draft,
      quotes: quote?.id ?? null,
      recipient: userToDm?.id ?? "",
    });

    setQuote(null);
    setDraft("");
    setUserToDm(null);
  }, [draft, quote, userToDm]);
  const requestDeleteMessage = useCallback((withText: string) => {
    socket.current?.emit(ChatHandlers.DELETE, withText);
  }, []);
  const deleteMessage = useCallback((withText: string) => {
    setMessages((prev) =>
      prev.filter((prevMessage) => prevMessage.text !== withText)
    );

    if (quote?.text === withText) {
      setQuote(null);
    }
  }, []);
  const quoteMessage = useCallback((message: IChatMessage) => {
    setQuote(message);

    try {
      document.getElementById("builtChatInput").focus();
    } catch (error) {}
  }, []);
  const context = useMemo<ChatProviderContext>(
    () => ({
      online,
      typing,
      messages,
      draft,
      quote,
      messageLookup,
      userToDm,
      quoteMessage,
      sendMessage,
      deleteMessage: requestDeleteMessage,
      updateDraft: setDraft,
      updateUserToDm: setUserToDm,
    }),
    [
      online,
      typing,
      messages,
      draft,
      quote,
      messageLookup,
      userToDm,
      sendMessage,
      deleteMessage,
      quoteMessage,
    ]
  );

  useEffect(() => {
    if (!socket.current) {
      socket.current = io();

      socket.current
        .on(ChatHandlers.CATCHUP, setMessages)
        .on(ChatHandlers.ONLINE, setOnline)
        .on(ChatHandlers.TYPING, setTyping)
        .on(ChatHandlers.SPEAK, addMessage)
        .on(ChatHandlers.DELETE, deleteMessage);
    }
  });

  const debouncedTypingUpdater = useMemo(
    () =>
      debounce(
        () => socket.current?.emit(ChatHandlers.TYPING, lastDraft.current),
        MINIMUM_TYPING_UPDATE_INTERVAL
      ),
    []
  );

  useEffect(() => {
    lastDraft.current = draft;
    debouncedTypingUpdater();
  }, [draft]);

  useEffect(() => {
    if (focused || document.hasFocus()) {
      setNotifications(0);
    }
  }, [focused]);

  useEffect(() => {
    setMessageLookup(
      messages.reduce((prev, next) => {
        prev[next.id] = next;
        return prev;
      }, {} as Record<string, IChatMessage>)
    );
  }, [messages]);

  // Display e.g. [+2] Chat when notifications occur when you're away.
  useEffect(() => {
    const title = document.getElementsByTagName("title")[0];
    const favicon = document.getElementById("favicon") as HTMLLinkElement;
    const escape = (window as any).escapeHTML;
    const alertedWhileAway = notifications > 0 && !focused;
    const pathIcon = alertedWhileAway ? "alert" : "icon";

    favicon.href = escape(`/assets/images/${siteName}/${pathIcon}.webp?v=3`);
    title.innerHTML = alertedWhileAway ? `[+${notifications}] Chat` : "Chat";
  }, [notifications, focused]);

  return (
    <ChatContext.Provider value={context}>{children}</ChatContext.Provider>
  );
}

export function useChat() {
  const value = useContext(ChatContext);
  return value;
}
