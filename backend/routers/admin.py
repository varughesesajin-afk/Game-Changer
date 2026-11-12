from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.community_access import PERIOD_DAYS, get_community, plus_days, to_community
from lib.dates import today_iso
from lib.db import db
from models.schemas import AdminOverview, AdminStats, AdminUser, Community, Tournament, User
from routers.communities import create_first_games

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    return user


@router.get("/overview", response_model=AdminOverview)
async def overview(_: User = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    comms = [to_community(c) for c in await db.communities.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)]
    owned: dict[str, int] = {}
    for c in comms:
        owned[c.owner_id] = owned.get(c.owner_id, 0) + 1
    pending_comms = [c for c in comms if c.approval_status == "pending"]
    requests = [c for c in comms if c.approval_status == "approved" and c.manage_requested_at]
    pending_t = [Tournament(**t) for t in await db.tournaments.find({"approval_status": "pending"}, {"_id": 0}).sort("created_at", 1).to_list(200)]
    stats = AdminStats(
        users=len(users),
        communities=sum(1 for c in comms if c.approval_status == "approved"),
        managed_communities=sum(1 for c in comms if c.manage_active),
        tournaments=await db.tournaments.count_documents({"approval_status": {"$nin": ["pending", "declined"]}}),
        upcoming_games=await db.games.count_documents({"date": {"$gte": today_iso()}}),
        pending_approvals=len(pending_comms) + len(requests) + len(pending_t),
    )
    return AdminOverview(
        stats=stats,
        users=[AdminUser(user_id=u["user_id"], name=u["name"], email=u["email"], role=u.get("role", "user"),
                         communities_owned=owned.get(u["user_id"], 0)) for u in users],
        communities=[c for c in comms if c.approval_status == "approved"],
        pending_communities=pending_comms,
        manage_requests=requests,
        pending_tournaments=pending_t,
        custom_formats=[Tournament(**t) for t in await db.tournaments.find({"format": "other"}, {"_id": 0}).sort("created_at", -1).to_list(100)],
    )


# ---------- new communities ----------
@router.post("/communities/{cid}/approve", response_model=Community)
async def approve_community(cid: str, _: User = Depends(require_admin)):
    """Make a new community live and grant its first 30 days of Manage."""
    c = await get_community(cid)
    if c.approval_status == "approved":
        return c
    await db.communities.update_one({"id": cid}, {"$set": {"approval_status": "approved", "manage_until": plus_days(PERIOD_DAYS),
                                                           "manage_requested_at": None}})
    c = await get_community(cid)
    if not await db.games.count_documents({"community_id": cid}):
        await create_first_games(c)
    return c


@router.post("/communities/{cid}/decline", response_model=Community)
async def decline_community(cid: str, _: User = Depends(require_admin)):
    await get_community(cid)
    await db.communities.update_one({"id": cid}, {"$set": {"approval_status": "declined", "manage_requested_at": None}})
    return await get_community(cid)


# ---------- 30-day Manage periods ----------
@router.post("/communities/{cid}/manage/approve", response_model=Community)
async def approve_manage(cid: str, _: User = Depends(require_admin)):
    """Grant another 30 days of Manage — counted from today, or from the end of the current period if it is still running."""
    c = await get_community(cid)
    if c.approval_status != "approved":
        raise HTTPException(400, "Approve the community first")
    start = c.manage_until if c.manage_until and c.manage_until >= today_iso() else today_iso()
    await db.communities.update_one({"id": cid}, {"$set": {"manage_until": plus_days(PERIOD_DAYS, start), "manage_requested_at": None}})
    return await get_community(cid)


@router.post("/communities/{cid}/manage/decline", response_model=Community)
async def decline_manage(cid: str, _: User = Depends(require_admin)):
    await get_community(cid)
    await db.communities.update_one({"id": cid}, {"$set": {"manage_requested_at": None}})
    return await get_community(cid)


@router.post("/communities/{cid}/manage/revoke", response_model=Community)
async def revoke_manage(cid: str, _: User = Depends(require_admin)):
    """Switch Manage off straight away (the community itself stays visible)."""
    await get_community(cid)
    await db.communities.update_one({"id": cid}, {"$set": {"manage_until": None, "manage_requested_at": None}})
    return await get_community(cid)


# ---------- community tournaments ----------
async def _tournament(tid: str) -> dict:
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Tournament not found")
    return t


@router.post("/tournaments/{tid}/approve", response_model=Tournament)
async def approve_tournament(tid: str, _: User = Depends(require_admin)):
    await _tournament(tid)
    await db.tournaments.update_one({"id": tid}, {"$set": {"approval_status": "approved"}})
    return Tournament(**await _tournament(tid))


@router.post("/tournaments/{tid}/decline", response_model=Tournament)
async def decline_tournament(tid: str, _: User = Depends(require_admin)):
    await _tournament(tid)
    await db.tournaments.update_one({"id": tid}, {"$set": {"approval_status": "declined"}})
    return Tournament(**await _tournament(tid))
