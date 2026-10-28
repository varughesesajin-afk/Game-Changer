"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
              IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "user_sessions": [IndexModel([("session_token", ASCENDING)], name="session_token", unique=True)],
    "communities": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                    IndexModel([("sport", ASCENDING), ("created_at", DESCENDING)], name="sport_created"),
                    IndexModel([("owner_id", ASCENDING)], name="owner"),
                    IndexModel([("members.user_id", ASCENDING)], name="members")],
    "games": [IndexModel([("id", ASCENDING)], name="id", unique=True),
              IndexModel([("community_id", ASCENDING), ("date", ASCENDING)], name="community_date"),
              IndexModel([("date", ASCENDING), ("time", ASCENDING)], name="date_time"),
              IndexModel([("roster.user_id", ASCENDING)], name="roster_user")],
    "tournaments": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                    IndexModel([("kind", ASCENDING), ("status", ASCENDING), ("start_date", ASCENDING)], name="kind_status_start"),
                    IndexModel([("community_id", ASCENDING)], name="community"),
                    IndexModel([("organiser_id", ASCENDING)], name="organiser"),
                    IndexModel([("teams.captain_id", ASCENDING)], name="captain")],
    "reminders": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                  IndexModel([("user_id", ASCENDING), ("game_id", ASCENDING)], name="user_game", unique=True),
                  IndexModel([("user_id", ASCENDING), ("dismissed", ASCENDING), ("game_date", ASCENDING)], name="user_active")],
    "payment_transactions": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
