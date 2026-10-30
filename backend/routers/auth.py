import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import ADMIN_EMAILS, current_user
from lib.db import db
from models.schemas import PictureIn, SessionIn, User

router = APIRouter(prefix="/auth", tags=["auth"])

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


@router.post("/session", response_model=User)
async def create_session(body: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data["email"].lower()
    role = "admin" if email in ADMIN_EMAILS else "user"
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name") or existing["name"],
                      **({} if existing.get("picture_custom") else {"picture": data.get("picture")}),
                      **({"role": "admin"} if role == "admin" else {})}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"), "role": role, "is_pro": False,
            "created_at": datetime.now(timezone.utc),
        })
    token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none",
                        path="/", max_age=7 * 24 * 3600)
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**doc)


@router.get("/me", response_model=User)
async def me(user: User = Depends(current_user)):
    return user


@router.put("/me/picture", response_model=User)
async def set_picture(body: PictureIn, user: User = Depends(current_user)):
    """Upload-your-own profile picture; propagated to memberships and upcoming rosters."""
    pic = body.picture or None
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"picture": pic, "picture_custom": bool(pic)}})
    await db.communities.update_many({"members.user_id": user.user_id}, {"$set": {"members.$[m].picture": pic}},
                                     array_filters=[{"m.user_id": user.user_id}])
    await db.communities.update_many({"join_requests.user_id": user.user_id}, {"$set": {"join_requests.$[m].picture": pic}},
                                     array_filters=[{"m.user_id": user.user_id}])
    await db.games.update_many({"roster.user_id": user.user_id}, {"$set": {"roster.$[r].picture": pic}},
                               array_filters=[{"r.user_id": user.user_id}])
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


@router.post("/logout")
async def logout(request: Request, response: Response):
    tok = request.cookies.get("session_token")
    if tok:
        await db.user_sessions.delete_one({"session_token": tok})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}
