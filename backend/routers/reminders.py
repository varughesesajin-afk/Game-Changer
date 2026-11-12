"""In-app fee reminders: organisers nudge players still marked unpaid for a game."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.community_access import get_community, require_manage
from lib.dates import today_iso
from lib.db import db
from models.schemas import Game, Reminder, RemindResult, RosterEntry, UnpaidGame, UnpaidPlayer, User

router = APIRouter(tags=["reminders"])


async def _send(g: Game, players: List[RosterEntry], sender: User) -> None:
    now = datetime.now(timezone.utc)
    for r in players:
        await db.reminders.update_one(
            {"user_id": r.user_id, "game_id": g.id},
            {"$set": {"dismissed": False, "created_at": now, "amount": g.fee, "community_name": g.community_name,
                      "game_date": g.date, "game_time": g.time, "community_id": g.community_id, "sent_by": sender.name},
             "$setOnInsert": {"id": Reminder.new_id(), "currency": "OMR"}},
            upsert=True,
        )


async def _managed_game(gid: str, user: User) -> Game:
    doc = await db.games.find_one({"id": gid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Game not found")
    g = Game(**doc)
    require_manage(await get_community(g.community_id), user)
    return g


async def _unpaid_games(cid: str) -> List[Game]:
    docs = await db.games.find({"community_id": cid, "fee": {"$gt": 0}, "roster": {"$elemMatch": {"paid": False}}}, {"_id": 0}) \
        .sort([("date", -1), ("time", -1)]).to_list(200)
    return [Game(**d) for d in docs]


@router.post("/games/{gid}/remind-unpaid", response_model=RemindResult)
async def remind_unpaid(gid: str, user: User = Depends(current_user)):
    g = await _managed_game(gid, user)
    unpaid = [r for r in g.roster if not r.paid]
    players = [r for r in unpaid if r.user_id]
    await _send(g, players, user)
    return RemindResult(reminded=len(players), skipped_guests=len(unpaid) - len(players))


@router.post("/games/{gid}/roster/{entry_id}/remind", response_model=RemindResult)
async def remind_one(gid: str, entry_id: str, user: User = Depends(current_user)):
    g = await _managed_game(gid, user)
    r = next((x for x in g.roster if x.id == entry_id), None)
    if not r:
        raise HTTPException(404, "Player not found on this game")
    if r.paid:
        raise HTTPException(400, f"{r.name} has already paid")
    if not r.user_id:
        raise HTTPException(400, f"{r.name} is a guest name without an app account — remind them in person")
    await _send(g, [r], user)
    return RemindResult(reminded=1, skipped_guests=0)


@router.get("/communities/{cid}/unpaid", response_model=List[UnpaidGame])
async def unpaid_list(cid: str, user: User = Depends(current_user)):
    """Every game of this community (played and upcoming) with players still marked unpaid."""
    require_manage(await get_community(cid), user)
    games = await _unpaid_games(cid)
    active = {(d["user_id"], d["game_id"]) async for d in db.reminders.find(
        {"game_id": {"$in": [g.id for g in games]}, "dismissed": False}, {"_id": 0, "user_id": 1, "game_id": 1})}
    return [UnpaidGame(game_id=g.id, date=g.date, time=g.time, fee=g.fee,
                       players=[UnpaidPlayer(entry_id=r.id, name=r.name, user_id=r.user_id, reminded=(r.user_id, g.id) in active)
                                for r in g.roster if not r.paid])
            for g in games]


@router.post("/communities/{cid}/remind-all-unpaid", response_model=RemindResult)
async def remind_all(cid: str, user: User = Depends(current_user)):
    require_manage(await get_community(cid), user)
    sent = skipped = 0
    for g in await _unpaid_games(cid):
        unpaid = [r for r in g.roster if not r.paid]
        players = [r for r in unpaid if r.user_id]
        await _send(g, players, user)
        sent += len(players)
        skipped += len(unpaid) - len(players)
    return RemindResult(reminded=sent, skipped_guests=skipped)


@router.get("/reminders/mine", response_model=List[Reminder])
async def my_reminders(user: User = Depends(current_user)):
    docs = await db.reminders.find({"user_id": user.user_id, "dismissed": False}, {"_id": 0}).sort("game_date", 1).to_list(50)
    out = []
    for d in docs:
        game = await db.games.find_one({"id": d["game_id"]}, {"_id": 0, "roster": 1})
        entry = next((r for r in (game or {}).get("roster", []) if r.get("user_id") == user.user_id), None)
        if entry and not entry.get("paid"):  # still on the roster and still unpaid
            out.append(Reminder(**d))
    return out


@router.post("/reminders/{rid}/dismiss")
async def dismiss(rid: str, user: User = Depends(current_user)):
    res = await db.reminders.update_one({"id": rid, "user_id": user.user_id}, {"$set": {"dismissed": True}})
    if not res.matched_count:
        raise HTTPException(404, "Reminder not found")
    return {"ok": True}
