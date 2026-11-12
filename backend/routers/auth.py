import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, unquote, urlencode

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse

from lib.auth import ADMIN_EMAILS, current_user
from lib.db import db
from models.schemas import PictureIn, User

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
SESSION_DAYS = 30


def base_url(request: Request) -> str:
    """Public address of the site. Set APP_BASE_URL (e.g. https://your-app.onrender.com) in production."""
    configured = os.environ.get("APP_BASE_URL", "").strip().rstrip("/")
    return configured or str(request.base_url).rstrip("/")


def safe_next(value: str | None) -> str:
    """Only allow on-site paths as the post-login destination (blocks open redirects like //evil.com)."""
    if value and value.startswith("/") and not value.startswith("//") and "\\" not in value and "\n" not in value:
        return value
    return "/profile"


def _fail(code: str) -> RedirectResponse:
    return RedirectResponse(f"/login?error={code}", status_code=302)


@router.get("/google/login")
async def google_login(request: Request, next: str = "/profile"):
    """Step 1: send the visitor to Google's sign-in page."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        return _fail("not_configured")
    base = base_url(request)
    state = secrets.token_urlsafe(24)
    params = {"client_id": client_id, "redirect_uri": f"{base}/api/auth/google/callback", "response_type": "code",
              "scope": "openid email profile", "state": state, "prompt": "select_account"}
    resp = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=302)
    secure = base.startswith("https://")
    resp.set_cookie("oauth_state", state, httponly=True, secure=secure, samesite="lax", path="/", max_age=600)
    resp.set_cookie("oauth_next", quote(safe_next(next), safe=""), httponly=True, secure=secure, samesite="lax", path="/", max_age=600)
    return resp


@router.get("/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    """Step 2: Google sends the visitor back here with a one-time code; swap it for the user's profile and start a session."""
    if error:
        return _fail("denied")
    expected = request.cookies.get("oauth_state")
    if not code or not state or not expected or not secrets.compare_digest(state, expected):
        return _fail("failed")
    base = base_url(request)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            tok = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code, "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""), "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": f"{base}/api/auth/google/callback", "grant_type": "authorization_code"})
            if tok.status_code != 200 or not tok.json().get("access_token"):
                return _fail("failed")
            info = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {tok.json()['access_token']}"})
            if info.status_code != 200:
                return _fail("failed")
    except httpx.HTTPError:
        return _fail("failed")
    data = info.json()
    email = (data.get("email") or "").lower()
    if not email or not data.get("email_verified"):
        return _fail("unverified")

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
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
        "created_at": datetime.now(timezone.utc),
    })
    resp = RedirectResponse(safe_next(unquote(request.cookies.get("oauth_next", ""))), status_code=302)
    resp.set_cookie("session_token", token, httponly=True, secure=base.startswith("https://"), samesite="lax",
                    path="/", max_age=SESSION_DAYS * 24 * 3600)
    resp.delete_cookie("oauth_state", path="/")
    resp.delete_cookie("oauth_next", path="/")
    return resp


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
    response.delete_cookie("session_token", path="/")
    return {"ok": True}
