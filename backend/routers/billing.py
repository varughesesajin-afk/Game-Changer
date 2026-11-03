"""Community Manage — OMR 1 per 30 days per community (after/before a 15-day free trial), paid through Thawani Pay checkout.
Keys come from backend/.env (THAWANI_*). With the Thawani UAT (test) keys no real money moves."""
import os
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import current_user
from lib.community_access import PERIOD_DAYS, get_community, plus_days
from lib.dates import today_iso
from lib.db import db
from models.schemas import CheckoutStart, CheckoutStatus, Community, PaymentRecord, Plan, User, _id, _now

router = APIRouter(prefix="/billing", tags=["billing"])

MANAGE_PLAN = Plan(
    id="community_manage", name="Community Manage", price=1.0, currency="OMR", interval="month",
    perks=["Edit community details", "Schedule weekly games", "Host community tournaments",
           "Remove members & roster names", "Track who has paid match fees"],
)
PRICE_BAISA = 1000  # 1.000 OMR


def _base() -> str:
    return os.environ.get("THAWANI_BASE_URL", "https://uatcheckout.thawani.om").rstrip("/")


def _is_test() -> bool:
    return "uat" in _base()


async def _thawani(method: str, path: str, **kw) -> dict:
    headers = {"Thawani-Api-Key": os.environ["THAWANI_SECRET_KEY"], "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.request(method, f"{_base()}/api/v1{path}", headers=headers, **kw)
    except httpx.HTTPError:
        raise HTTPException(502, "Payment provider is unreachable — please try again")
    if r.status_code >= 400:
        raise HTTPException(502, "Payment provider error — please try again")
    return r.json().get("data") or {}


@router.get("/plans", response_model=List[Plan])
async def plans():
    return [MANAGE_PLAN]


@router.post("/communities/{cid}/checkout", response_model=CheckoutStart)
async def start_checkout(cid: str, request: Request, user: User = Depends(current_user)):
    c = await get_community(cid)
    if c.owner_id != user.user_id:
        raise HTTPException(403, "Only this community's host can pay for it")
    origin = request.headers.get("origin") or os.environ.get("APP_URL", "")
    ref = _id()
    data = await _thawani("POST", "/checkout/session", json={
        "client_reference_id": ref,
        "mode": "payment",
        "products": [{"name": f"Manage: {c.name}"[:40], "quantity": 1, "unit_amount": PRICE_BAISA}],
        "success_url": f"{origin}/payment/return?ref={ref}",
        "cancel_url": f"{origin}/payment/return?ref={ref}&cancelled=1",
        "metadata": {"community_id": c.id, "user_id": user.user_id},
    })
    sid = data.get("session_id")
    if not sid:
        raise HTTPException(502, "Payment provider did not start a checkout")
    await db.checkout_sessions.insert_one({"ref": ref, "session_id": sid, "user_id": user.user_id, "user_name": user.name,
                                           "community_id": c.id, "community_name": c.name, "status": "unpaid",
                                           "fulfilled": False, "created_at": _now()})
    return CheckoutStart(ref=ref, redirect_url=f"{_base()}/pay/{sid}?key={os.environ['THAWANI_PUBLISHABLE_KEY']}")


@router.get("/checkout/{ref}", response_model=CheckoutStatus)
async def checkout_status(ref: str, user: User = Depends(current_user)):
    s = await db.checkout_sessions.find_one({"ref": ref}, {"_id": 0})
    if not s or (s["user_id"] != user.user_id and user.role != "admin"):
        raise HTTPException(404, "Payment not found")
    if not s["fulfilled"]:
        data = await _thawani("GET", f"/checkout/session/{s['session_id']}")
        status = data.get("payment_status", "unknown")
        await db.checkout_sessions.update_one({"ref": ref}, {"$set": {"status": status}})
        s["status"] = status
        if status == "paid":
            # atomic flip so a payment unlocks Manage exactly once
            won = await db.checkout_sessions.find_one_and_update({"ref": ref, "fulfilled": False}, {"$set": {"fulfilled": True}})
            if won:
                doc = await db.communities.find_one({"id": s["community_id"]}, {"_id": 0, "manage_until": 1}) or {}
                cur = doc.get("manage_until")
                start = cur if cur and cur >= today_iso() else today_iso()  # paying early extends the current period
                await db.communities.update_one({"id": s["community_id"]}, {"$set": {"manage_until": plus_days(PERIOD_DAYS, start)}})
                rec = PaymentRecord(user_id=s["user_id"], user_name=s.get("user_name", ""), community_id=s["community_id"],
                                    community_name=s["community_name"], plan_id=MANAGE_PLAN.id, amount=MANAGE_PLAN.price,
                                    currency=MANAGE_PLAN.currency, mocked=_is_test())
                await db.payment_transactions.insert_one(rec.model_dump())
    return CheckoutStatus(ref=ref, community_id=s["community_id"], community_name=s["community_name"],
                          payment_status=s["status"], paid=s["status"] == "paid")


@router.get("/history", response_model=List[PaymentRecord])
async def history(user: User = Depends(current_user)):
    docs = await db.payment_transactions.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [PaymentRecord(**d) for d in docs]
