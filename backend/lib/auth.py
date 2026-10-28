"""Session auth (Emergent Google OAuth). Session token in httpOnly cookie, Bearer header fallback."""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request

from lib.db import db
from models.schemas import User

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "varughesesajin@gmail.com").split(",") if e.strip()}


def _token(request: Request) -> Optional[str]:
    tok = request.cookies.get("session_token")
    if tok:
        return tok
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def optional_user(request: Request) -> Optional[User]:
    tok = _token(request)
    if not tok:
        return None
    sess = await db.user_sessions.find_one({"session_token": tok}, {"_id": 0})
    if not sess:
        return None
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        return None
    doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not doc:
        return None
    user = User(**doc)
    # Pro expiry check
    if user.is_pro and user.pro_until and user.pro_until < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"is_pro": False}})
        user.is_pro = False
    return user


async def current_user(request: Request) -> User:
    user = await optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def is_admin(user: User) -> bool:
    return user.role == "admin"
