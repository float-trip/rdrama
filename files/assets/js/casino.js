// Shared
function updatePlayerCoins(updated) {
	if (updated.coins) {
		document.getElementById("user-coins-amount").innerText = updated.coins;
	}

	if (updated.procoins) {
		document.getElementById("user-bux-amount").innerText = updated.procoins;
	}
}

// Slots
function pullSlots() {
	const wager = document.getElementById("casinoSlotsBet").value;
	const currency = document.querySelector(
		'input[name="casinoSlotsCurrency"]:checked'
	).value;

	document.getElementById("casinoSlotsBet").disabled = true;
	document.getElementById("casinoSlotsPull").disabled = true;

	const xhr = new XMLHttpRequest();
	xhr.open("post", "/casino/slots");
	xhr.onload = handleSlotsResponse.bind(null, xhr);

	const form = new FormData();
	form.append("formkey", formkey());
	form.append("wager", wager);
	form.append("currency", currency);

	xhr.send(form);
}

function handleSlotsResponse(xhr) {
	let response;

	try {
		response = JSON.parse(xhr.response);
	} catch (error) {
		console.error(error);
	}

	const succeeded =
		xhr.status >= 200 && xhr.status < 300 && response && !response.error;
	const slotsResult = document.getElementById("casinoSlotsResult");
	slotsResult.classList.remove("text-success", "text-danger");

	if (succeeded) {
		const { game_state, gambler } = response;
		const state = JSON.parse(game_state);
		const reels = Array.from(document.querySelectorAll(".reel"));
		const symbols = state.symbols.split(",");

		for (let i = 0; i < 3; i++) {
			reels[i].innerHTML = symbols[i];
		}

		slotsResult.style.visibility = "visible";
		slotsResult.innerText = state.text;

		if (state.text.includes("Won")) {
			if (state.text.includes("Jackpot")) {
				slotsResult.classList.add("text-warning");
			} else {
				slotsResult.classList.add("text-success");
			}
		} else if (state.text.includes("Lost")) {
			slotsResult.classList.add("text-danger");
		}

		updatePlayerCoins(gambler);
	} else {
		slotsResult.style.visibility = "visible";
		slotsResult.innerText = response.error;
		slotsResult.classList.add("text-danger");

		console.error(response.error);
	}

	document.getElementById("casinoSlotsBet").disabled = false;
	document.getElementById("casinoSlotsPull").disabled = false;
}

// Blackjack

// Checking existing status onload.
// When the casino loads, look up the "blackjack status" of a player to either start a new game or continue an existing game.
if (
	document.readyState === "complete" ||
	(document.readyState !== "loading" && !document.documentElement.doScroll)
) {
	checkBlackjackStatus();
} else {
	document.addEventListener("DOMContentLoaded", checkBlackjackStatus);
}

function checkBlackjackStatus() {
	const xhr = new XMLHttpRequest();
	xhr.open("get", "/casino/blackjack/status");
	xhr.onload = handleBlackjackStatusResponse.bind(null, xhr);
	xhr.send();
}

function handleBlackjackStatusResponse(xhr) {
	let response;

	try {
		response = JSON.parse(xhr.response);
	} catch (error) {
		console.error(error);
	}

	const succeeded =
		xhr.status >= 200 && xhr.status < 300 && response && !response.error;

	if (succeeded) {
		if (response.active) {
			updateBlackjack(response.game_state);
		} else {
			updateBlackjackActions(null);
		}
	} else {
		console.error("error");
	}
}

// DOM Manipulation

// When starting a new game or taking an action in an existing one, a new state will be returned, and the DOM must be updated.
function updateBlackjack(state) {
	const { player, dealer, status } = state;
	const lettersToSuits = {
		S: "♠️",
		H: "♥️",
		C: "♣️",
		D: "♦️",
		"?": "?",
	};
	const suitsToColors = {
		"♠️": "black",
		"♥️": "red",
		"♣️": "black",
		"♦️": "red",
		"?": "black",
	};

	// Clear everything.
	Array.from(document.querySelectorAll(".playing-card")).forEach((card) => {
		card.innerText = "";
		card.style.color = "unset";
		card.classList.remove("dealt");
	});

	// Show dealer cards.
	const dealerSlots = Array.from(
		document.querySelectorAll('.playing-card[data-who="dealer"]')
	);
	for (let i = 0; i < dealer.length; i++) {
		const slot = dealerSlots[i];

		if (slot) {
			// Technically, the dealer can use more than 5 cards, though it's rare.
			// In that case, the result message is good enough.
			// Thanks, Carp. 🐠
			slot.classList.add("dealt");

			if (i > 0 && status === "active") {
				break;
			}

			const rank = dealer[i][0];
			const suit = lettersToSuits[dealer[i][1]];
			const card = rank + suit;
			slot.innerText = card;
			slot.style.color = suitsToColors[suit];
		}
	}

	// Show player cards.
	const playerSlots = Array.from(
		document.querySelectorAll('.playing-card[data-who="player"]')
	);
	for (let i = 0; i < player.length; i++) {
		const slot = playerSlots[i];
		const rank = player[i][0];
		const suit = lettersToSuits[player[i][1]];
		const card = rank + suit;
		slot.innerText = card;
		slot.style.color = suitsToColors[suit];
		slot.classList.add("dealt");
	}

	updateBlackjackActions(state);

	if (status !== "active") {
		revealBlackjackResult(state);
	}
}

function revealBlackjackResult(state) {
	const blackjackResult = document.getElementById("casinoBlackjackResult");
	const lookup = {
		bust: ["Bust. Didn't work out for you, did it?", "danger"],
		push: ["Pushed. This whole hand never happened.", "secondary"],
		insured_loss: ["Lost, but at least you had insurance.", "secondary"],
		lost: ["Lost. That was pathetic.", "danger"],
		won: ["Won. This time.", "success"],
		blackjack: ["Blackjack! Must be your lucky day.", "warning"],
	};
	const [resultText, resultClass] = lookup[state.status];

	blackjackResult.style.visibility = "visible";
	blackjackResult.innerText = resultText;
	blackjackResult.classList.add(`text-${resultClass}`);
}

function buildBlackjackAction(id, method, title, fullWidth = false) {
	return `
		<button
			type="button"
			class="btn btn-${fullWidth ? "primary" : "secondary"} lottery-page--action"
			id="${id}"
			onclick="${method}()"
			style="${fullWidth ? "width: 100%;" : ""}"
		>
			${title}
		</button>
	`;
}

function clearBlackjackActions() {
	const actionWrapper = document.getElementById("casinoBlackjackActions");
	actionWrapper.innerHTML = "";
}

function updateBlackjackActions(state) {
	const actionWrapper = document.getElementById("casinoBlackjackActions");

	clearBlackjackActions();

	if (state && state.status === "active") {
		document.getElementById("casinoBlackjackWager").style.display = "none";

		const actionLookup = {
			hit: buildBlackjackAction("casinoBlackjackHit", "hitBlackjack", "Hit"),
			stay: buildBlackjackAction(
				"casinoBlackjackStay",
				"stayBlackjack",
				"Stay"
			),
			double_down: buildBlackjackAction(
				"casinoBlackjackDouble",
				"doubleBlackjack",
				"Double Down"
			),
			insure: buildBlackjackAction(
				"casinoBlackjackInsure",
				"insureBlackjack",
				"Insure"
			),
		};
		const actions = state.actions.map((action) => actionLookup[action]);

		actionWrapper.innerHTML = actions.join("\n");
	} else {
		// Game is over, deal a new game.
		showWagerWidget();

		const deal = buildBlackjackAction(
			"casinoBlackjackDeal",
			"dealBlackjack",
			"Deal",
			true
		);

		actionWrapper.innerHTML = deal;
	}
}

function hideWagerWidget() {
	document.getElementById("casinoBlackjackBet").disabled = true;
	document.getElementById("casinoBlackjackDeal").disabled = true;
	document.getElementById("casinoBlackjackWager").style.display = "none";
	document.getElementById("casinoBlackjackResult").style.visibility = "hidden";
}

function showWagerWidget() {
	document.getElementById("casinoBlackjackWager").style.display = "flex";
	document.getElementById("casinoBlackjackBet").disabled = false;
}

// Actions, Requests & Responses
function takeBlackjackAction(action, args = {}) {
	const xhr = new XMLHttpRequest();
	xhr.open("post", "/casino/blackjack/action");
	xhr.onload = handleBlackjackResponse.bind(null, xhr);

	const form = new FormData();
	form.append("formkey", formkey());
	form.append("action", action);

	for (const [key, value] of Object.entries(args)) {
		form.append(key, value);
	}

	xhr.send(form);
}

const dealBlackjack = () => {
	const wager = document.getElementById("casinoBlackjackBet").value;
	const currency = document.querySelector('input[name="casinoBlackjackCurrency"]:checked').value;

	hideWagerWidget();
	takeBlackjackAction("deal", { currency, wager });
}
const hitBlackjack = takeBlackjackAction.bind(null, "hit");
const stayBlackjack = takeBlackjackAction.bind(null, "stay");
const doubleBlackjack = takeBlackjackAction.bind(null, "double_down");
const insureBlackjack = takeBlackjackAction.bind(null, "insure");

function handleBlackjackResponse(xhr) {
	let response;

	try {
		response = JSON.parse(xhr.response);
	} catch (error) {
		console.error(error);
	}

	const succeeded =
		xhr.status >= 200 && xhr.status < 300 && response && !response.error;
	const blackjackResult = document.getElementById("casinoBlackjackResult");
	blackjackResult.classList.remove("text-success", "text-danger", "text-warning");

	if (succeeded) {
		if (response.game_state) {
			updateBlackjack(response.game_state);
		}

		if (response.gambler) {
			updatePlayerCoins(response.gambler);
		}
	} else {
		blackjackResult.style.visibility = "visible";
		blackjackResult.innerText = response.error;
		blackjackResult.classList.add("text-danger");

		console.error(response.error);
	}
}