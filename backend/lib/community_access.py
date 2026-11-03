"""Community access helpers. Manage = owner in the 15-day free trial OR with a paid 30-day period (OMR 1), or site admin.
Premium (host tournaments, gallery uploads) = paid period only, never during the trial."""
from datetime import date, timedelta

from fastapi import HTTPException

from lib.dates import today_iso
from lib.db import db
from models.schemas import Community, User

TRIAL_DAYS = 15
PERIOD_DAYS = 30  # each OMR 1 payment buys this many days


def plus_days(n: int, start: str | None = None) -> str:
    return (date.fromisoformat(start or today_iso()) + timedelta(days=n)).isoformat()


def to_community(doc: dict) -> Community:
    c = Community(**doc)
    today = today_iso()
    paid = bool(c.manage_until and c.manage_until >= today)
    trial = bool(c.trial_until and c.trial_until >= today)
    c.premium_active = paid
    c.in_trial = trial and not paid
    c.manage_active = paid or trial
    return c


async def get_community(cid: str) -> Community:
    doc = await db.communities.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Community not found")
    return to_community(doc)


def can_manage(c: Community, user: User | None) -> bool:
    if not user:
        return False
    return user.role == "admin" or (c.owner_id == user.user_id and c.manage_active)


def require_manage(c: Community, user: User) -> None:
    if user.role == "admin":
        return
    if c.owner_id != user.user_id:
        raise HTTPException(403, "Only this community's organiser can manage it")
    if not c.manage_active:
        raise HTTPException(402, "Manage is locked — pay OMR 1 for 30 days to keep managing this community")


def require_premium(c: Community, user: User) -> None:
    """Tournaments and photo uploads: paid period only (not part of the free trial)."""
    if user.role == "admin":
        return
    if c.owner_id != user.user_id:
        raise HTTPException(403, "Only this community's host can do this")
    if not c.premium_active:
        raise HTTPException(402, "Hosting tournaments and uploading photos need a paid month — pay OMR 1 for 30 days to unlock")
