"""Browser push subscriptions: the app registers a device here, and /push/test sends a trial notification."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib import push
from lib.auth import current_user
from lib.db import db
from models.schemas import User

router = APIRouter(prefix="/push", tags=["push"])


class Keys(BaseModel):
    p256dh: str
    auth: str


class SubscribeIn(BaseModel):
    endpoint: str
    keys: Keys


class UnsubscribeIn(BaseModel):
    endpoint: str


@router.get("/config")
async def config():
    return {"enabled": push.enabled(), "public_key": push.PUBLIC_KEY if push.enabled() else None}


@router.get("/status")
async def status(endpoint: str, user: User = Depends(current_user)):
    return {"subscribed": bool(await db.push_subscriptions.find_one({"endpoint": endpoint, "user_id": user.user_id}, {"_id": 1}))}


@router.post("/subscribe")
async def subscribe(body: SubscribeIn, user: User = Depends(current_user)):
    if not push.enabled():
        raise HTTPException(503, "Notifications are not switched on for this site yet")
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"user_id": user.user_id, "p256dh": body.keys.p256dh, "auth": body.keys.auth},
         "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/unsubscribe")
async def unsubscribe(body: UnsubscribeIn, user: User = Depends(current_user)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user.user_id})
    return {"ok": True}


@router.post("/test")
async def test(user: User = Depends(current_user)):
    sent = await push.notify([user.user_id], "Notifications are on", "You'll get match, fee and approval alerts here.", "/", "test")
    if not sent:
        raise HTTPException(400, "No device could be reached — turn notifications on first")
    return {"sent": sent}
