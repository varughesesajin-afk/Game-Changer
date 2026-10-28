from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.community_access import to_community
from lib.dates import today_iso
from lib.db import db
from models.schemas import AdminOverview, AdminStats, AdminUser, PaymentRecord, User

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    return user


@router.get("/overview", response_model=AdminOverview)
async def overview(_: User = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    comms = [to_community(c) for c in await db.communities.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)]
    pays = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    owned: dict[str, int] = {}
    for c in comms:
        owned[c.owner_id] = owned.get(c.owner_id, 0) + 1
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    def aware(dt: datetime) -> datetime:
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    paid = [p for p in pays if p.get("status") == "paid"]
    stats = AdminStats(
        users=len(users),
        communities=len(comms),
        managed_communities=sum(1 for c in comms if c.manage_active),
        tournaments=await db.tournaments.count_documents({}),
        upcoming_games=await db.games.count_documents({"date": {"$gte": today_iso()}}),
        revenue_total=round(sum(p["amount"] for p in paid), 2),
        revenue_30d=round(sum(p["amount"] for p in paid if aware(p["created_at"]) >= cutoff), 2),
    )
    return AdminOverview(
        stats=stats,
        users=[AdminUser(user_id=u["user_id"], name=u["name"], email=u["email"], role=u.get("role", "user"),
                         communities_owned=owned.get(u["user_id"], 0)) for u in users],
        communities=comms,
        payments=[PaymentRecord(**p) for p in pays[:50]],
    )
