"""Web push notifications (free, no WhatsApp/SMS fees).

Players allow notifications in the browser/installed app; we keep their push subscription in `push_subscriptions`
and send through pywebpush using VAPID keys from the environment (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
If the keys or the library are missing, every call is a harmless no-op, so the app never breaks because of push.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from pymongo.errors import DuplicateKeyError

from lib.db import db

logger = logging.getLogger(__name__)

PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
SUBJECT = os.environ.get("VAPID_SUBJECT", "").strip() or os.environ.get("APP_BASE_URL", "").strip() or "https://greenoceansportingevents.com"


def enabled() -> bool:
    return bool(PUBLIC_KEY and PRIVATE_KEY)


def _send_one(sub: dict, payload: str) -> Optional[int]:
    """Blocking send. Returns an HTTP status when the push service rejected it (404/410 = subscription is gone)."""
    from pywebpush import WebPushException, webpush  # imported lazily so a missing package only disables push

    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=payload,
            vapid_private_key=PRIVATE_KEY,
            vapid_claims={"sub": SUBJECT},
            ttl=60 * 60 * 12,
        )
        return None
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        logger.warning("push failed (%s): %s", status, exc)
        return status or 0


async def notify(user_ids: Iterable[str], title: str, body: str, url: str = "/", tag: Optional[str] = None) -> int:
    """Push to every device of the given users. Never raises. Returns how many devices accepted it."""
    ids = [u for u in dict.fromkeys(user_ids) if u]
    if not ids or not enabled():
        return 0
    try:
        subs = await db.push_subscriptions.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(2000)
        if not subs:
            return 0
        payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
        results = await asyncio.gather(*(asyncio.to_thread(_send_one, s, payload) for s in subs), return_exceptions=True)
        ok = 0
        for s, r in zip(subs, results):
            if r is None:
                ok += 1
            elif r in (404, 410):
                await db.push_subscriptions.delete_one({"endpoint": s["endpoint"]})
        return ok
    except Exception:  # push must never break the request that triggered it
        logger.exception("notify failed")
        return 0


async def admin_ids() -> list[str]:
    from lib.auth import ADMIN_EMAILS

    docs = await db.users.find({"$or": [{"email": {"$in": list(ADMIN_EMAILS)}}, {"role": "admin"}]}, {"_id": 0, "user_id": 1}).to_list(50)
    return [d["user_id"] for d in docs]


# ---------- scheduled match / payment reminders ----------
def _tz() -> ZoneInfo:
    return ZoneInfo(os.environ.get("APP_TZ", "UTC"))


def _start(g: dict) -> Optional[datetime]:
    try:
        return datetime.strptime(f"{g['date']} {g.get('time') or '00:00'}", "%Y-%m-%d %H:%M").replace(tzinfo=_tz())
    except (KeyError, ValueError):
        return None


async def _once(key: str) -> bool:
    """True the first time a (kind, game, user) reminder is claimed; False if it was already sent."""
    try:
        await db.push_sent.insert_one({"key": key, "at": datetime.now(_tz())})
        return True
    except DuplicateKeyError:
        return False


async def run_reminders() -> int:
    """One pass: 'match within 24h', 'starts within 2h' and 'fee still unpaid after the match'. Each is sent once per player."""
    if not enabled():
        return 0
    now = datetime.now(_tz())
    sent = 0
    lo = (now - timedelta(days=8)).strftime("%Y-%m-%d")
    hi = (now + timedelta(days=2)).strftime("%Y-%m-%d")
    games = await db.games.find({"date": {"$gte": lo, "$lte": hi}}, {"_id": 0}).to_list(2000)
    subscribed = set(await db.push_subscriptions.distinct("user_id"))
    if not subscribed:
        return 0
    for g in games:
        start = _start(g)
        if not start:
            continue
        hours = (start - now).total_seconds() / 3600
        roster = [r for r in g.get("roster", []) if r.get("user_id") in subscribed]
        if not roster:
            continue
        where = f" · {g['venue']}" if g.get("venue") else ""
        url = f"/communities/{g['community_id']}"
        for r in roster:
            uid = r["user_id"]
            if 0 < hours <= 2:
                if await _once(f"soon:{g['id']}:{uid}"):
                    sent += await notify([uid], "Game starting soon", f"{g['community_name']} kicks off at {g['time']}{where}.", url, f"soon-{g['id']}")
            elif 2 < hours <= 24:
                if await _once(f"day:{g['id']}:{uid}"):
                    day = "Today" if start.date() == now.date() else "Tomorrow"
                    sent += await notify([uid], "Game coming up", f"{g['community_name']}{where} — {day.lower()} at {g['time']}.", url, f"day-{g['id']}")
            elif hours < -3 and (g.get("fee") or 0) > 0 and not r.get("paid"):
                if await _once(f"fee:{g['id']}:{uid}"):
                    sent += await notify([uid], "Fee still due", f"OMR {g['fee']:g} for {g['community_name']} on {g['date']} is unpaid.", url, f"fee-{g['id']}")
    return sent


async def reminder_loop(every_seconds: int = 600) -> None:
    from lib import engagement  # lazy: engagement imports this module

    await asyncio.sleep(30)  # let the app finish booting
    while True:
        try:
            await engagement.finalize_due()
            n = await run_reminders()
            if n:
                logger.info("push reminders sent: %s", n)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("reminder pass failed")
        await asyncio.sleep(every_seconds)
