"""Organiser Pro subscription. PAYMENTS ARE MOCKED — no real charge is made (Stripe sandbox unavailable in OM)."""
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.schemas import PaymentRecord, Plan, SubscribeIn, User

router = APIRouter(prefix="/billing", tags=["billing"])

PERKS = ["Unlimited communities", "Host community tournaments with brackets",
         "Recurring weekly game scheduling", "Collect match fees from players", "Pro organiser badge"]
PLANS = [
    Plan(id="pro_monthly", name="Organiser Pro Monthly", price=5.0, currency="OMR", interval="month", perks=PERKS),
    Plan(id="pro_yearly", name="Organiser Pro Yearly", price=50.0, currency="OMR", interval="year", perks=PERKS),
]


@router.get("/plans", response_model=List[Plan])
async def plans():
    return PLANS


@router.post("/subscribe", response_model=User)
async def subscribe(body: SubscribeIn, user: User = Depends(current_user)):
    plan = next((p for p in PLANS if p.id == body.plan_id), None)
    if not plan:
        raise HTTPException(404, "Plan not found")
    days = 30 if plan.interval == "month" else 365
    start = max(date.fromisoformat(today_iso()), date.fromisoformat(user.pro_until) if user.is_pro and user.pro_until else date.min)
    until = (start + timedelta(days=days)).isoformat()
    rec = PaymentRecord(user_id=user.user_id, plan_id=plan.id, amount=plan.price, currency=plan.currency)
    await db.payment_transactions.insert_one(rec.model_dump())
    await db.users.update_one({"user_id": user.user_id},
                              {"$set": {"is_pro": True, "pro_plan": plan.id, "pro_until": until}})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


@router.post("/cancel", response_model=User)
async def cancel(user: User = Depends(current_user)):
    await db.users.update_one({"user_id": user.user_id},
                              {"$set": {"is_pro": False, "pro_plan": None, "pro_until": None}})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


@router.get("/history", response_model=List[PaymentRecord])
async def history(user: User = Depends(current_user)):
    docs = await db.payment_transactions.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [PaymentRecord(**d) for d in docs]
