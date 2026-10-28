"""In-app fee reminders: organisers nudge players still marked unpaid for a game."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.community_access import get_community, require_manage
from lib.dates import today_iso
from lib.db import db
from models.schemas import Game, Reminder, RemindResult, User

router = APIRouter(tags=["reminders"])


@router.post("/games/{gid}/remind-unpaid", response_model=RemindResult)
async def remind_unpaid(gid: str, user: User = Depends(current_user)):
    doc = await db.games.find_one({"id": gid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Game not found")
    g = Game(**doc)
    require_manage(await get_community(g.community_id), user)
    unpaid = [r for r in g.roster if not r.paid]
    players = [r for r in unpaid if r.user_id]
    now = datetime.now(timezone.utc)
    for r in players:
        await db.reminders.update_one(
            {"user_id": r.user_id, "game_id": g.id},
            {"$set": {"dismissed": False, "created_at": now, "amount": g.fee, "community_name": g.community_name,
                      "game_date": g.date, "game_time": g.time, "community_id": g.community_id, "sent_by": user.name},
             "$setOnInsert": {"id": Reminder.new_id(), "currency": "OMR"}},
            upsert=True,
        )
    return RemindResult(reminded=len(players), skipped_guests=len(unpaid) - len(players))


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
