"""Man-of-the-match voting and badges."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib import engagement
from lib.auth import current_user, optional_user
from lib.db import db
from models.schemas import BadgesOut, Game, MotmCandidate, MotmPending, MotmState, MotmVoteIn, User

router = APIRouter(tags=["motm"])


async def _game(gid: str) -> Game:
    d = await db.games.find_one({"id": gid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Game not found")
    return Game(**d)


async def _state(g: Game, user: Optional[User]) -> MotmState:
    status = engagement.vote_status(g)
    if status == "closed" and not g.motm_final:
        await engagement.finalize_game(g)
        g = await _game(g.id)
    votes = await db.motm_votes.find({"game_id": g.id}, {"_id": 0}).to_list(500)
    tally: dict = {}
    for v in votes:
        tally[v["entry_id"]] = tally.get(v["entry_id"], 0) + 1
    mine = next((v["entry_id"] for v in votes if user and v["voter_id"] == user.user_id), None)
    me_on_roster = bool(user and any(r.user_id == user.user_id for r in g.roster))
    show = status == "closed" or mine is not None
    cands = [MotmCandidate(entry_id=r.id, name=r.name, picture=r.picture, team=r.team, goals=r.goals,
                           votes=tally.get(r.id, 0) if show else None, is_me=bool(user and r.user_id == user.user_id))
             for r in g.roster]
    if show:
        cands.sort(key=lambda c: -(c.votes or 0))
    return MotmState(
        game_id=g.id, status=status, closes_at=engagement._iso(g.motm_closes_at),
        can_vote=status == "open" and me_on_roster, my_vote=mine, voters=len({v["voter_id"] for v in votes}),
        eligible=len({r.user_id for r in g.roster if r.user_id}),
        winner_entry_id=(g.result.motm_entry_id if g.result and status == "closed" else None),
        by_vote=bool(status == "closed" and tally), candidates=cands)


@router.get("/games/{gid}/motm", response_model=MotmState)
async def motm_state(gid: str, user: Optional[User] = Depends(optional_user)):
    return await _state(await _game(gid), user)


@router.post("/games/{gid}/motm/vote", response_model=MotmState)
async def motm_vote(gid: str, body: MotmVoteIn, user: User = Depends(current_user)):
    g = await _game(gid)
    if engagement.vote_status(g) != "open":
        raise HTTPException(400, "Voting for this game is closed")
    if not any(r.user_id == user.user_id for r in g.roster):
        raise HTTPException(403, "Only players on this game can vote")
    pick = next((r for r in g.roster if r.id == body.entry_id), None)
    if not pick:
        raise HTTPException(400, "Pick a player from this game")
    if pick.user_id == user.user_id:
        raise HTTPException(400, "You can't vote for yourself")
    await db.motm_votes.update_one({"game_id": gid, "voter_id": user.user_id},
                                   {"$set": {"entry_id": body.entry_id, "at": datetime.now(timezone.utc)}}, upsert=True)
    return await _state(g, user)


@router.get("/motm/pending", response_model=List[MotmPending])
async def pending(user: User = Depends(current_user)):
    """Games where this player can still vote and hasn't."""
    now = datetime.now(timezone.utc)
    docs = await db.games.find({"roster.user_id": user.user_id, "motm_closes_at": {"$gt": now}, "motm_final": {"$ne": True}},
                               {"_id": 0}).sort("motm_closes_at", 1).to_list(20)
    voted = {v["game_id"] async for v in db.motm_votes.find({"voter_id": user.user_id}, {"_id": 0, "game_id": 1})}
    return [MotmPending(game_id=d["id"], community_id=d["community_id"], community_name=d["community_name"], date=d["date"],
                        closes_at=engagement._iso(d["motm_closes_at"]))
            for d in docs if d["id"] not in voted and len(d.get("roster", [])) >= 2]


@router.get("/badges/{user_id}", response_model=BadgesOut)
async def badges(user_id: str):
    return await engagement.badges_for(user_id)
