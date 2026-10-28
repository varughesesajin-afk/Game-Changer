from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import current_user, is_admin, optional_user
from lib.dates import today_iso
from lib.db import db
from models.schemas import (Community, CommunityCreate, Feed, Game, GameCreate, GuestIn,
                            JoinGameIn, Member, RosterEntry, Tournament, User)

router = APIRouter(tags=["communities"])

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
FREE_COMMUNITY_LIMIT = 1


def next_dates(days: List[str]) -> List[str]:
    today = date.fromisoformat(today_iso())
    out = []
    for d in days:
        if d in WEEKDAYS:
            delta = (WEEKDAYS.index(d) - today.weekday()) % 7
            out.append((today + timedelta(days=delta)).isoformat())
    return sorted(set(out))


async def _get_community(cid: str) -> Community:
    doc = await db.communities.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Community not found")
    return Community(**doc)


async def _get_game(gid: str) -> Game:
    doc = await db.games.find_one({"id": gid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Game not found")
    return Game(**doc)


def _game_from(c: Community, d: str, time: Optional[str] = None) -> Game:
    return Game(community_id=c.id, community_name=c.name, sport=c.sport, date=d, time=time or c.time,
                venue=c.venue, max_players=c.max_players, fee=c.fee)


# ---------- feed ----------
@router.get("/feed", response_model=Feed)
async def feed(sport: Optional[str] = None):
    q = {"sport": sport} if sport and sport != "All" else {}
    active = {**q, "status": {"$ne": "completed"}}
    official = await db.tournaments.find({**active, "kind": "official"}, {"_id": 0}).sort("start_date", 1).to_list(10)
    comm_t = await db.tournaments.find({**active, "kind": "community"}, {"_id": 0}).sort("start_date", 1).to_list(10)
    games = await db.games.find({**q, "date": {"$gte": today_iso()}}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(10)
    comms = await db.communities.find(q, {"_id": 0}).sort("created_at", -1).to_list(10)
    return Feed(official=[Tournament(**t) for t in official], community_tournaments=[Tournament(**t) for t in comm_t],
                upcoming_games=[Game(**g) for g in games], communities=[Community(**c) for c in comms])


# ---------- communities ----------
@router.get("/communities", response_model=List[Community])
async def list_communities(sport: Optional[str] = None, mine: bool = False, q: Optional[str] = None,
                           user: Optional[User] = Depends(optional_user)):
    query: dict = {}
    if sport and sport != "All":
        query["sport"] = sport
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if mine:
        if not user:
            raise HTTPException(401, "Not authenticated")
        query["$or"] = [{"owner_id": user.user_id}, {"members.user_id": user.user_id}]
    docs = await db.communities.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Community(**d) for d in docs]


@router.post("/communities", response_model=Community)
async def create_community(body: CommunityCreate, user: User = Depends(current_user)):
    if not (user.is_pro or is_admin(user)):
        owned = await db.communities.count_documents({"owner_id": user.user_id})
        if owned >= FREE_COMMUNITY_LIMIT:
            raise HTTPException(402, "Free plan allows 1 community. Upgrade to Organiser Pro to host more.")
    c = Community(**body.model_dump(), owner_id=user.user_id, owner_name=user.name,
                  members=[Member(user_id=user.user_id, name=user.name, picture=user.picture)])
    await db.communities.insert_one(c.model_dump())
    for d in next_dates(c.days):
        await db.games.insert_one(_game_from(c, d).model_dump())
    return c


@router.get("/communities/{cid}", response_model=Community)
async def get_community(cid: str):
    return await _get_community(cid)


@router.delete("/communities/{cid}")
async def delete_community(cid: str, user: User = Depends(current_user)):
    c = await _get_community(cid)
    if c.owner_id != user.user_id and not is_admin(user):
        raise HTTPException(403, "Only the organiser can delete this community")
    await db.communities.delete_one({"id": cid})
    await db.games.delete_many({"community_id": cid})
    return {"ok": True}


@router.post("/communities/{cid}/join", response_model=Community)
async def join_community(cid: str, user: User = Depends(current_user)):
    await _get_community(cid)
    await db.communities.update_one(
        {"id": cid, "members.user_id": {"$ne": user.user_id}},
        {"$push": {"members": Member(user_id=user.user_id, name=user.name, picture=user.picture).model_dump()}},
    )
    return await _get_community(cid)


@router.post("/communities/{cid}/leave", response_model=Community)
async def leave_community(cid: str, user: User = Depends(current_user)):
    c = await _get_community(cid)
    if c.owner_id == user.user_id:
        raise HTTPException(400, "Organiser cannot leave their own community")
    await db.communities.update_one({"id": cid}, {"$pull": {"members": {"user_id": user.user_id}}})
    return await _get_community(cid)


@router.get("/communities/{cid}/games", response_model=List[Game])
async def community_games(cid: str):
    docs = await db.games.find({"community_id": cid, "date": {"$gte": today_iso()}}, {"_id": 0}) \
        .sort([("date", 1), ("time", 1)]).to_list(50)
    return [Game(**d) for d in docs]


@router.post("/communities/{cid}/games", response_model=Game)
async def create_game(cid: str, body: GameCreate, user: User = Depends(current_user)):
    c = await _get_community(cid)
    if c.owner_id != user.user_id and not is_admin(user):
        raise HTTPException(403, "Only the organiser can schedule games")
    if body.date < today_iso():
        raise HTTPException(400, "Date must be today or later")
    g = _game_from(c, body.date, body.time)
    await db.games.insert_one(g.model_dump())
    return g


@router.post("/communities/{cid}/schedule-week", response_model=List[Game])
async def schedule_next_week(cid: str, user: User = Depends(current_user)):
    """Create the next occurrence (after the latest scheduled one) for each recurring day."""
    c = await _get_community(cid)
    if c.owner_id != user.user_id and not is_admin(user):
        raise HTTPException(403, "Only the organiser can schedule games")
    created = []
    for d in c.days:
        if d not in WEEKDAYS:
            continue
        latest = await db.games.find({"community_id": cid}, {"_id": 0, "date": 1}).sort("date", -1).to_list(200)
        same_day = [g["date"] for g in latest if date.fromisoformat(g["date"]).weekday() == WEEKDAYS.index(d)]
        base = max(same_day) if same_day else None
        if base and base >= today_iso():
            nd = (date.fromisoformat(base) + timedelta(days=7)).isoformat()
        else:
            nd = next_dates([d])[0]
        g = _game_from(c, nd)
        await db.games.insert_one(g.model_dump())
        created.append(g)
    return created


# ---------- games / rosters ----------
@router.get("/games/mine", response_model=List[Game])
async def my_games(user: User = Depends(current_user)):
    docs = await db.games.find({"roster.user_id": user.user_id, "date": {"$gte": today_iso()}}, {"_id": 0}) \
        .sort([("date", 1), ("time", 1)]).to_list(100)
    return [Game(**d) for d in docs]


@router.get("/games/{gid}", response_model=Game)
async def get_game(gid: str):
    return await _get_game(gid)


@router.post("/games/{gid}/join", response_model=Game)
async def join_game(gid: str, body: JoinGameIn, user: User = Depends(current_user)):
    g = await _get_game(gid)
    mine = next((r for r in g.roster if r.user_id == user.user_id), None)
    if mine:
        await db.games.update_one({"id": gid, "roster.id": mine.id}, {"$set": {"roster.$.team": body.team}})
    else:
        if len(g.roster) >= g.max_players:
            raise HTTPException(409, "This game is full")
        entry = RosterEntry(user_id=user.user_id, name=user.name, team=body.team, added_by=user.user_id)
        await db.games.update_one({"id": gid}, {"$push": {"roster": entry.model_dump()}})
        # joining a game also makes you a community member
        await db.communities.update_one(
            {"id": g.community_id, "members.user_id": {"$ne": user.user_id}},
            {"$push": {"members": Member(user_id=user.user_id, name=user.name, picture=user.picture).model_dump()}},
        )
    return await _get_game(gid)


@router.post("/games/{gid}/leave", response_model=Game)
async def leave_game(gid: str, user: User = Depends(current_user)):
    await _get_game(gid)
    await db.games.update_one({"id": gid}, {"$pull": {"roster": {"user_id": user.user_id}}})
    return await _get_game(gid)


@router.post("/games/{gid}/guests", response_model=Game)
async def add_guest(gid: str, body: GuestIn, user: User = Depends(current_user)):
    g = await _get_game(gid)
    if len(g.roster) >= g.max_players:
        raise HTTPException(409, "This game is full")
    entry = RosterEntry(user_id=None, name=body.name.strip(), team=body.team, added_by=user.user_id)
    await db.games.update_one({"id": gid}, {"$push": {"roster": entry.model_dump()}})
    return await _get_game(gid)


@router.delete("/games/{gid}/roster/{entry_id}", response_model=Game)
async def remove_entry(gid: str, entry_id: str, user: User = Depends(current_user)):
    g = await _get_game(gid)
    entry = next((r for r in g.roster if r.id == entry_id), None)
    if not entry:
        raise HTTPException(404, "Entry not found")
    c = await _get_community(g.community_id)
    if user.user_id not in (entry.added_by, entry.user_id, c.owner_id) and not is_admin(user):
        raise HTTPException(403, "Not allowed")
    await db.games.update_one({"id": gid}, {"$pull": {"roster": {"id": entry_id}}})
    return await _get_game(gid)
