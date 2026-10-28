"""Community Manage subscription — OMR 1 / month per community.
PAYMENTS ARE MOCKED — no real charge is made (real provider to be switched on later)."""
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.community_access import get_community
from lib.dates import today_iso
from lib.db import db
from models.schemas import Community, PaymentRecord, Plan, User

router = APIRouter(prefix="/billing", tags=["billing"])

MANAGE_PLAN = Plan(
    id="community_manage", name="Community Manage", price=1.0, currency="OMR", interval="month",
    perks=["Edit community details", "Schedule weekly games", "Host community tournaments",
           "Remove members & roster names", "Track who has paid match fees"],
)


@router.get("/plans", response_model=List[Plan])
async def plans():
    return [MANAGE_PLAN]


@router.post("/communities/{cid}/subscribe", response_model=Community)
async def subscribe(cid: str, user: User = Depends(current_user)):
    c = await get_community(cid)
    if c.owner_id != user.user_id:
        raise HTTPException(403, "Only this community's organiser can subscribe")
    today = date.fromisoformat(today_iso())
    start = max(today, date.fromisoformat(c.manage_until)) if c.manage_active and c.manage_until else today
    until = (start + timedelta(days=30)).isoformat()
    rec = PaymentRecord(user_id=user.user_id, user_name=user.name, community_id=c.id, community_name=c.name,
                        plan_id=MANAGE_PLAN.id, amount=MANAGE_PLAN.price, currency=MANAGE_PLAN.currency)
    await db.payment_transactions.insert_one(rec.model_dump())
    await db.communities.update_one({"id": cid}, {"$set": {"manage_until": until}})
    return await get_community(cid)


@router.post("/communities/{cid}/cancel", response_model=Community)
async def cancel(cid: str, user: User = Depends(current_user)):
    c = await get_community(cid)
    if c.owner_id != user.user_id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    await db.communities.update_one({"id": cid}, {"$set": {"manage_until": None}})
    return await get_community(cid)


@router.get("/history", response_model=List[PaymentRecord])
async def history(user: User = Depends(current_user)):
    docs = await db.payment_transactions.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [PaymentRecord(**d) for d in docs]
