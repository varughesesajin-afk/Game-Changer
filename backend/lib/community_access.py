"""Community access helpers — admin approval instead of payments.

* A new community is created as `pending` and only goes live once the site admin approves it.
* Approval grants Manage for 30 days (`manage_until`). The host asks again before it ends and the admin approves another
  30 days. While Manage is not active the host keeps the community but cannot edit it, schedule games or host tournaments.
* Every community tournament also needs the admin's approval (see routers/tournaments.py).
* Site admins always have full access."""
from datetime import date, timedelta

from fastapi import HTTPException

from lib.dates import today_iso
from lib.db import db
from models.schemas import Community, User

PERIOD_DAYS = 30  # each admin approval grants this many days of Manage


def plus_days(n: int, start: str | None = None) -> str:
    return (date.fromisoformat(start or today_iso()) + timedelta(days=n)).isoformat()


def to_community(doc: dict) -> Community:
    c = Community(**doc)
    c.manage_active = c.approval_status == "approved" and bool(c.manage_until and c.manage_until >= today_iso())
    return c


async def get_community(cid: str) -> Community:
    doc = await db.communities.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Community not found")
    return to_community(doc)


def is_visible_to(c: Community, user: User | None) -> bool:
    """Pending / declined communities are visible only to their host and the admin."""
    if c.approval_status == "approved":
        return True
    return bool(user and (user.role == "admin" or user.user_id == c.owner_id))


def can_manage(c: Community, user: User | None) -> bool:
    if not user:
        return False
    return user.role == "admin" or (c.owner_id == user.user_id and c.manage_active)


def require_manage(c: Community, user: User) -> None:
    if user.role == "admin":
        return
    if c.owner_id != user.user_id:
        raise HTTPException(403, "Only this community's organiser can manage it")
    if c.approval_status == "pending":
        raise HTTPException(403, "This community is waiting for the admin's approval")
    if c.approval_status == "declined":
        raise HTTPException(403, "The admin did not approve this community")
    if not c.manage_active:
        raise HTTPException(403, "Manage is locked — ask the admin to approve another 30 days for this community")
