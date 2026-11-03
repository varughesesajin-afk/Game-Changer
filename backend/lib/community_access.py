"""Community access helpers shared by routers. 'Manage' = owner with an one-time OMR 1 payment, or site admin."""
from fastapi import HTTPException

from lib.dates import today_iso
from lib.db import db
from models.schemas import Community, User

LIFETIME = "9999-12-31"  # manage_until value for a one-time (never-expiring) unlock


def to_community(doc: dict) -> Community:
    c = Community(**doc)
    c.manage_active = bool(c.manage_until and c.manage_until >= today_iso())
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
        raise HTTPException(402, "Unlock Manage (one-time OMR 1) for this community to use this")
