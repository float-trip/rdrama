from typing import List, Optional, Union
from files.classes import *
from flask import g

def get_id(username:str, graceful=False) -> Optional[int]:
	username = username.replace('\\', '').replace('_', '\_').replace('%', '').strip()
	user = g.db.query(
		User.id
		).filter(
		or_(
			User.username.ilike(username),
			User.original_username.ilike(username)
			)
		).one_or_none()

	if not user:
		if not graceful: abort(404)
		else: return None

	return user[0]

def get_user(username:str, v:Optional[User]=None, graceful=False, rendered=False, include_blocks=False, include_shadowbanned=True) -> Optional[User]:
	if not username:
		if not graceful: abort(404)
		else: return None

	username = username.replace('\\', '').replace('_', '\_').replace('%', '').replace('(', '').replace(')', '').strip()
	user = g.db.query(
		User
		).filter(
		or_(
			User.username.ilike(username),
			User.original_username.ilike(username)
			)
		)

	user = user.one_or_none()

	if not user or (user.shadowbanned and not (include_shadowbanned or (v and v.can_see_shadowbanned))):
		if not graceful: abort(404)
		else: return None

	if rendered and v and include_blocks:
		if v.id == user.id:
			user.is_blocked = False
			user.is_blocking = False
		else:
			block = g.db.query(UserBlock).filter(
				or_(
					and_(
						UserBlock.user_id == v.id,
						UserBlock.target_id == user.id
					),
					and_(UserBlock.user_id == user.id,
						UserBlock.target_id == v.id
						)
				)
			).first()

			user.is_blocking = block and block.user_id == v.id
			user.is_blocked = block and block.target_id == v.id


	return user

def get_users(usernames:List[str], graceful=False) -> List[User]:
	def clean(n):
		return n.replace('\\', '').replace('_', '\_').replace('%', '').strip()

	usernames = [clean(n) for n in usernames]
	users = g.db.query(User).filter(
		or_(
			User.username.ilike(any_(usernames)),
			User.original_username.ilike(any_(usernames))
			)
		).all()

	if len(users) != len(usernames) and not graceful:
		abort(404)

	return users

def get_account(id:Union[str, int], v=None, graceful=False, include_blocks=False, include_shadowbanned=True) -> Optional[User]:
	try: 
		id = int(id)
	except:
		if not graceful: abort(404)
		else: return None

	user = g.db.get(User, id)

	if not user or (user.shadowbanned and not (include_shadowbanned or (v and v.can_see_shadowbanned))):
		if not graceful: abort(404)
		else: return None

	if v and include_blocks:
		block = g.db.query(UserBlock).filter(
			or_(
				and_(
					UserBlock.user_id == v.id,
					UserBlock.target_id == user.id
				),
				and_(UserBlock.user_id == user.id,
					 UserBlock.target_id == v.id
					 )
			)
		).first()

		user.is_blocking = block and block.user_id == v.id
		user.is_blocked = block and block.target_id == v.id

	return user


def get_post(i:Union[str, int], v=None, graceful=False) -> Optional[Submission]:
	try: i = int(i)
	except: abort(404)

	if not i:
		if graceful: return None
		else: abort(404)

	if v:
		vt = g.db.query(Vote).filter_by(user_id=v.id, submission_id=i).subquery()
		blocking = v.blocking.subquery()

		post = g.db.query(
			Submission,
			vt.c.vote_type,
			blocking.c.target_id,
		)

		post=post.filter(Submission.id == i
		).join(
			vt, 
			vt.c.submission_id == Submission.id, 
			isouter=True
		).join(
			blocking, 
			blocking.c.target_id == Submission.author_id, 
			isouter=True
		)

		post=post.one_or_none()
		
		if not post:
			if graceful: return None
			else: abort(404)

		x = post[0]
		x.voted = post[1] or 0
		x.is_blocking = post[2] or 0
	else:
		post = g.db.get(Submission, i)
		if not post:
			if graceful: return None
			else: abort(404)
		x=post

	return x


def get_posts(pids:List[int], v:Optional[User]=None) -> List[Submission]:
	if not pids:
		return []

	if v:
		vt = g.db.query(Vote.vote_type, Vote.submission_id).filter(
			Vote.submission_id.in_(pids), 
			Vote.user_id==v.id
			).subquery()

		blocking = v.blocking.subquery()
		blocked = v.blocked.subquery()

		query = g.db.query(
			Submission,
			vt.c.vote_type,
			blocking.c.target_id,
			blocked.c.target_id,
		).filter(
			Submission.id.in_(pids)
		).join(
			vt, vt.c.submission_id==Submission.id, isouter=True
		).join(
			blocking, 
			blocking.c.target_id == Submission.author_id, 
			isouter=True
		).join(
			blocked, 
			blocked.c.user_id == Submission.author_id, 
			isouter=True
		).all()

		output = [p[0] for p in query]
		for i in range(len(output)):
			output[i].voted = query[i][1] or 0
			output[i].is_blocking = query[i][2] or 0
			output[i].is_blocked = query[i][3] or 0
	else:
		output = g.db.query(Submission,).filter(Submission.id.in_(pids)).all()

	return sorted(output, key=lambda x: pids.index(x.id))

def get_comment(i:Union[str, int], v=None, graceful=False) -> Optional[Comment]:
	try: i = int(i)
	except: abort(404)

	if not i:
		if graceful: return None
		else: abort(404)

	comment=g.db.get(Comment, i)
	if not comment:
		if graceful: return None
		else: abort(404)

	if v:
		block = g.db.query(UserBlock).filter(
			or_(
				and_(
					UserBlock.user_id == v.id,
					UserBlock.target_id == comment.author_id
				),
				and_(
					UserBlock.user_id == comment.author_id,
					UserBlock.target_id == v.id
				)
			)
		).first()

		vt = g.db.query(CommentVote.vote_type).filter_by(user_id=v.id, comment_id=comment.id).one_or_none()
		comment.is_blocking = block and block.user_id == v.id
		comment.is_blocked = block and block.target_id == v.id
		comment.voted = vt.vote_type if vt else 0

	return comment


def get_comments(cids:List[int], v:Optional[User]=None) -> List[Comment]:
	if not cids: return []
	if v:
		votes = g.db.query(CommentVote.vote_type, CommentVote.comment_id).filter_by(user_id=v.id).subquery()

		blocking = v.blocking.subquery()

		blocked = v.blocked.subquery()

		comments = g.db.query(
			Comment,
			votes.c.vote_type,
			blocking.c.target_id,
			blocked.c.target_id,
		).filter(Comment.id.in_(cids))
 
		comments = comments.join(
			votes,
			votes.c.comment_id == Comment.id,
			isouter=True
		).join(
			blocking,
			blocking.c.target_id == Comment.author_id,
			isouter=True
		).join(
			blocked,
			blocked.c.user_id == Comment.author_id,
			isouter=True
		).all()

		output = []
		for c in comments:
			comment = c[0]
			comment.voted = c[1] or 0
			comment.is_blocking = c[2] or 0
			comment.is_blocked = c[3] or 0
			output.append(comment)

	else:
		output = g.db.query(Comment).join(Comment.author).filter(User.shadowbanned == None, Comment.id.in_(cids)).all()

	return sorted(output, key=lambda x: cids.index(x.id))

def get_sub_by_name(sub:str, v:Optional[User]=None, graceful=False) -> Optional[Sub]:
	if not sub:
		if graceful: return None
		else: abort(404)
	sub = sub.replace('/h/', '').strip().lower()
	if not sub:
		if graceful: return None
		else: abort(404)
	sub = g.db.get(Sub, sub)
	if not sub:
		if graceful: return None
		else: abort(404)
	return sub
