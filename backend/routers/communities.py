from datetime import date, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user, is_admin, optional_user
from lib.community_access import TRIAL_DAYS, get_community as _get_community, plus_days, require_manage, to_community
from lib.dates import today_iso
from lib.db import db
from models.schemas import (Community, CommunityCreateIn, CommunityUpdate, Feed, Game, GameCreate, GameNotice, GameUpdate,
                            GameResult, GameResultIn, GuestIn, JoinGameIn, Leaderboard, LeaderboardRow, Member,
                            PaidIn, PlayerCommunityStats, PlayerGameLine, PlayerProfile, RosterEntry, SeasonIn,
                            Tournament, User)

router = APIRouter(tags=["communities"])

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def next_dates(days: List[str]) -> List[str]:
    today = date.fromisoformat(today_iso())
    out = []
    for d in days:
        if d in WEEKDAYS:
            delta = (WEEKDAYS.index(d) - today.weekday()) % 7
            out.append((today + timedelta(days=delta)).isoformat())
    return sorted(set(out))


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
                upcoming_games=[Game(**g) for g in games], communities=[to_community(c) for c in comms])


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
    return [to_community(d) for d in docs]


@router.post("/communities", response_model=Community)
async def create_community(body: CommunityCreateIn, user: User = Depends(current_user)):
    if not is_admin(user):
        # each extra community needs its host to be paid up on the ones they already run
        unpaid = await db.communities.find_one({"owner_id": user.user_id, "$or": [{"manage_until": None}, {"manage_until": {"$lt": today_iso()}}]}, {"_id": 0, "name": 1})
        if unpaid:
            raise HTTPException(402, f"Pay OMR 1 for {unpaid['name']} before starting another community.")
    c = Community(**body.model_dump(), owner_id=user.user_id, owner_name=user.name,
                  members=[Member(user_id=user.user_id, name=user.name, picture=user.picture)], trial_until=plus_days(TRIAL_DAYS))
    doc = c.model_dump()
    for k in ("manage_active", "premium_active", "in_trial"):
        doc.pop(k, None)
    await db.communities.insert_one(doc)
    for d in next_dates(c.days):
        await db.games.insert_one(_game_from(c, d).model_dump())
    return to_community(doc)


@router.get("/communities/{cid}", response_model=Community)
async def get_community(cid: str):
    return await _get_community(cid)


@router.patch("/communities/{cid}", response_model=Community)
async def update_community(cid: str, body: CommunityUpdate, user: User = Depends(current_user)):
    c = await _get_community(cid)
    require_manage(c, user)
    changes = body.model_dump(exclude_none=True)
    if changes:
        await db.communities.update_one({"id": cid}, {"$set": changes})
        game_fields = {k: changes[k] for k in ("venue", "fee", "max_players", "sport") if k in changes}
        if "name" in changes:
            game_fields["community_name"] = changes["name"]
        if game_fields:
            await db.games.update_many({"community_id": cid, "date": {"$gte": today_iso()}}, {"$set": game_fields})
        if "name" in changes:
            await db.tournaments.update_many({"community_id": cid}, {"$set": {"community_name": changes["name"]}})
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
    """Ask to join — the host approves or declines."""
    c = await _get_community(cid)
    if any(m.user_id == user.user_id for m in c.members):
        return c
    await db.communities.update_one(
        {"id": cid, "join_requests.user_id": {"$ne": user.user_id}},
        {"$push": {"join_requests": Member(user_id=user.user_id, name=user.name, picture=user.picture).model_dump()}},
    )
    return await _get_community(cid)


def _require_host(c: Community, user: User) -> None:
    if c.owner_id != user.user_id and not is_admin(user):
        raise HTTPException(403, "Only the community host can do this")


@router.post("/communities/{cid}/requests/{uid}/approve", response_model=Community)
async def approve_request(cid: str, uid: str, user: User = Depends(current_user)):
    c = await _get_community(cid)
    _require_host(c, user)
    req = next((m for m in c.join_requests if m.user_id == uid), None)
    if not req:
        raise HTTPException(404, "No pending request from this player")
    await db.communities.update_one({"id": cid}, {"$pull": {"join_requests": {"user_id": uid}}})
    await db.communities.update_one({"id": cid, "members.user_id": {"$ne": uid}}, {"$push": {"members": req.model_dump()}})
    return await _get_community(cid)


@router.post("/communities/{cid}/requests/{uid}/decline", response_model=Community)
async def decline_request(cid: str, uid: str, user: User = Depends(current_user)):
    c = await _get_community(cid)
    _require_host(c, user)
    await db.communities.update_one({"id": cid}, {"$pull": {"join_requests": {"user_id": uid}}})
    return await _get_community(cid)


@router.post("/communities/{cid}/leave", response_model=Community)
async def leave_community(cid: str, user: User = Depends(current_user)):
    c = await _get_community(cid)
    if c.owner_id == user.user_id:
        raise HTTPException(400, "Organiser cannot leave their own community")
    await db.communities.update_one({"id": cid}, {"$pull": {"members": {"user_id": user.user_id},
                                                            "join_requests": {"user_id": user.user_id}}})
    return await _get_community(cid)


@router.delete("/communities/{cid}/members/{uid}", response_model=Community)
async def remove_member(cid: str, uid: str, user: User = Depends(current_user)):
    c = await _get_community(cid)
    require_manage(c, user)
    if uid == c.owner_id:
        raise HTTPException(400, "The organiser cannot be removed")
    await db.communities.update_one({"id": cid}, {"$pull": {"members": {"user_id": uid}}})
    await db.games.update_many({"community_id": cid, "date": {"$gte": today_iso()}}, {"$pull": {"roster": {"user_id": uid}}})
    return await _get_community(cid)


@router.get("/communities/{cid}/games", response_model=List[Game])
async def community_games(cid: str, past: bool = False):
    if past:  # played games (today and earlier), most recent first
        docs = await db.games.find({"community_id": cid, "date": {"$lte": today_iso()}}, {"_id": 0}) \
            .sort([("date", -1), ("time", -1)]).to_list(30)
    else:
        docs = await db.games.find({"community_id": cid, "date": {"$gte": today_iso()}}, {"_id": 0}) \
            .sort([("date", 1), ("time", 1)]).to_list(50)
    return [Game(**d) for d in docs]


def season_start_for(c: Community) -> tuple[Optional[str], str]:
    """Effective season start (server-anchored) and a human label."""
    today = date.fromisoformat(today_iso())
    auto: Optional[str] = None
    label = "All games"
    if c.season_length == "month":
        auto = today.replace(day=1).isoformat()
        label = today.strftime("%b %Y")
    elif c.season_length == "quarter":
        q = (today.month - 1) // 3
        auto = today.replace(month=q * 3 + 1, day=1).isoformat()
        label = f"Q{q + 1} {today.year}"
    start = max([d for d in (auto, c.season_start) if d], default=None)
    if c.season_start and start == c.season_start and c.season_start != auto:
        label = f"Since {date.fromisoformat(c.season_start).strftime('%d %b %Y')}"
    return start, label


def _key(r: RosterEntry) -> str:
    return r.user_id or f"guest:{r.name.strip().lower()}"


def _outcome(g: Game, team: str) -> str:
    if not g.result:
        return "pending"
    if g.result.winner == "draw":
        return "draw"
    return "won" if g.result.winner == team else "lost"


PLAYED = lambda extra: {**extra, "$or": [{"result": {"$ne": None}}, {"date": {"$lt": today_iso()}}]}  # noqa: E731


@router.get("/communities/{cid}/leaderboard", response_model=Leaderboard)
async def leaderboard(cid: str, scope: Literal["season", "all"] = "season"):
    c = await _get_community(cid)
    start, label = season_start_for(c)
    q: dict = {"community_id": cid}
    if scope == "season" and start:
        q["date"] = {"$gte": start}
    played = await db.games.find(PLAYED(q), {"_id": 0}).to_list(3000)
    rows: dict[str, LeaderboardRow] = {}
    for doc in played:
        g = Game(**doc)
        for r in g.roster:
            key = _key(r)
            row = rows.get(key) or LeaderboardRow(key=key, name=r.name, user_id=r.user_id, picture=r.picture,
                                                  games=0, wins=0, goals=0)
            row.games += 1
            row.goals += r.goals
            if _outcome(g, r.team) == "won":
                row.wins += 1
            if g.result and g.result.motm_entry_id == r.id:
                row.motm += 1
            rows[key] = row
    uids = [r.user_id for r in rows.values() if r.user_id]
    pics = {u["user_id"]: u.get("picture") for u in await db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "picture": 1}).to_list(len(uids) or 1)}
    for r in rows.values():
        if r.user_id:
            r.picture = pics.get(r.user_id) or r.picture
    return Leaderboard(scope=scope, season_label=label if scope == "season" else "All time",
                       season_start=start if scope == "season" else None,
                       rows=sorted(rows.values(), key=lambda x: (-x.games, -x.wins, -x.goals, x.name)))


@router.post("/communities/{cid}/season", response_model=Community)
async def set_season(cid: str, body: SeasonIn, user: User = Depends(current_user)):
    c = await _get_community(cid)
    require_manage(c, user)
    changes: dict = {"season_length": body.season_length}
    if body.start_now:
        changes["season_start"] = today_iso()
    await db.communities.update_one({"id": cid}, {"$set": changes})
    return await _get_community(cid)


@router.get("/players/{key}", response_model=PlayerProfile)
async def player_profile(key: str, community_id: Optional[str] = None):
    """Registered players (key = user_id) aggregate across all communities; guests (key = guest:<name>)
    are only identifiable by name, so they're scoped to one community."""
    if key.startswith("guest:"):
        if not community_id:
            raise HTTPException(400, "community_id is required for guest players")
        name_l = key[6:]
        q = PLAYED({"community_id": community_id, "roster.user_id": None})
        match = lambda r: r.user_id is None and r.name.strip().lower() == name_l  # noqa: E731
        user_doc = None
    else:
        q = PLAYED({"roster.user_id": key})
        match = lambda r: r.user_id == key  # noqa: E731
        user_doc = await db.users.find_one({"user_id": key}, {"_id": 0, "name": 1, "picture": 1})
    games = [Game(**d) for d in await db.games.find(q, {"_id": 0}).sort("date", -1).to_list(3000)]
    per: dict[str, PlayerCommunityStats] = {}
    recent: List[PlayerGameLine] = []
    name = user_doc["name"] if user_doc else None  # registered users always resolve, even with 0 games
    for g in games:
        r = next((x for x in g.roster if match(x)), None)
        if not r:
            continue
        name = name or r.name
        out = _outcome(g, r.team)
        motm = bool(g.result and g.result.motm_entry_id == r.id)
        st = per.get(g.community_id) or PlayerCommunityStats(community_id=g.community_id, community_name=g.community_name,
                                                             sport=g.sport, games=0, wins=0, goals=0, motm=0)
        st.games += 1
        st.wins += out == "won"
        st.goals += r.goals
        st.motm += motm
        per[g.community_id] = st
        if len(recent) < 15:
            recent.append(PlayerGameLine(game_id=g.id, community_id=g.community_id, community_name=g.community_name,
                                         sport=g.sport, date=g.date, team=r.team, goals=r.goals, outcome=out, motm=motm))
    if name is None:
        raise HTTPException(404, "Player not found")  # unknown user and no games
    comms = sorted(per.values(), key=lambda x: -x.games)
    totals = PlayerCommunityStats(community_id="", community_name="All communities", sport="",
                                  games=sum(x.games for x in comms), wins=sum(x.wins for x in comms),
                                  goals=sum(x.goals for x in comms), motm=sum(x.motm for x in comms))
    return PlayerProfile(key=key, name=name, user_id=None if key.startswith("guest:") else key,
                         picture=(user_doc or {}).get("picture"), totals=totals, communities=comms, recent=recent)


@router.post("/communities/{cid}/games", response_model=Game)
async def create_game(cid: str, body: GameCreate, user: User = Depends(current_user)):
    c = await _get_community(cid)
    require_manage(c, user)
    if body.date < today_iso():
        raise HTTPException(400, "Date must be today or later")
    if await db.games.find_one({"community_id": cid, "date": body.date}, {"_id": 1}):
        raise HTTPException(409, "A game is already scheduled on that date — reschedule it instead")
    g = _game_from(c, body.date, body.time)
    if body.venue:
        g.venue = body.venue
    await db.games.insert_one(g.model_dump())
    return g


@router.post("/communities/{cid}/schedule-week", response_model=List[Game])
async def schedule_next_week(cid: str, user: User = Depends(current_user)):
    """Create the next occurrence (after the latest scheduled one) for each recurring day."""
    c = await _get_community(cid)
    require_manage(c, user)
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


@router.get("/games/mine", response_model=List[Game])
async def my_games(user: User = Depends(current_user)):
    docs = await db.games.find({"roster.user_id": user.user_id, "date": {"$gte": today_iso()}}, {"_id": 0}) \
        .sort([("date", 1), ("time", 1)]).to_list(100)
    return [Game(**d) for d in docs]


@router.get("/games/mine/soon", response_model=List[GameNotice])
async def my_games_soon(user: User = Depends(current_user)):
    """Games the user signed up for that are today or tomorrow (server-anchored dates)."""
    today = today_iso()
    tomorrow = (date.fromisoformat(today) + timedelta(days=1)).isoformat()
    docs = await db.games.find({"roster.user_id": user.user_id, "date": {"$in": [today, tomorrow]}}, {"_id": 0}) \
        .sort([("date", 1), ("time", 1)]).to_list(20)
    return [GameNotice(game=Game(**d), when="today" if d["date"] == today else "tomorrow") for d in docs]


@router.get("/games/{gid}", response_model=Game)
async def get_game(gid: str):
    return await _get_game(gid)


async def _require_can_play(g: Game, user: User) -> None:
    c = await _get_community(g.community_id)
    if c.visibility == "private" and not is_admin(user) and c.owner_id != user.user_id \
            and not any(m.user_id == user.user_id for m in c.members):
        raise HTTPException(403, "This is a private community — only approved members can join its games")


@router.post("/games/{gid}/join", response_model=Game)
async def join_game(gid: str, body: JoinGameIn, user: User = Depends(current_user)):
    g = await _get_game(gid)
    mine = next((r for r in g.roster if r.user_id == user.user_id), None)
    if mine:
        await db.games.update_one({"id": gid, "roster.id": mine.id}, {"$set": {"roster.$.team": body.team}})
    else:
        await _require_can_play(g, user)
        if len(g.roster) >= g.max_players:
            raise HTTPException(409, "This game is full")
        entry = RosterEntry(user_id=user.user_id, name=user.name, team=body.team, added_by=user.user_id, picture=user.picture)
        await db.games.update_one({"id": gid}, {"$push": {"roster": entry.model_dump()}})
    return await _get_game(gid)


@router.post("/games/{gid}/leave", response_model=Game)
async def leave_game(gid: str, user: User = Depends(current_user)):
    await _get_game(gid)
    await db.games.update_one({"id": gid}, {"$pull": {"roster": {"user_id": user.user_id}}})
    return await _get_game(gid)


@router.post("/games/{gid}/guests", response_model=Game)
async def add_guest(gid: str, body: GuestIn, user: User = Depends(current_user)):
    g = await _get_game(gid)
    await _require_can_play(g, user)
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
    if user.user_id not in (entry.added_by, entry.user_id):
        # removing someone else's name is a Manage action
        require_manage(await _get_community(g.community_id), user)
    await db.games.update_one({"id": gid}, {"$pull": {"roster": {"id": entry_id}}})
    return await _get_game(gid)


@router.post("/games/{gid}/roster/{entry_id}/paid", response_model=Game)
async def set_paid(gid: str, entry_id: str, body: PaidIn, user: User = Depends(current_user)):
    g = await _get_game(gid)
    require_manage(await _get_community(g.community_id), user)
    res = await db.games.update_one({"id": gid, "roster.id": entry_id}, {"$set": {"roster.$.paid": body.paid}})
    if not res.matched_count:
        raise HTTPException(404, "Entry not found")
    if body.paid:
        entry = next((r for r in g.roster if r.id == entry_id), None)
        if entry and entry.user_id:
            await db.reminders.delete_one({"user_id": entry.user_id, "game_id": gid})
    return await _get_game(gid)


@router.post("/games/{gid}/result", response_model=Game)
async def record_result(gid: str, body: GameResultIn, user: User = Depends(current_user)):
    g = await _get_game(gid)
    require_manage(await _get_community(g.community_id), user)
    if g.date > today_iso():
        raise HTTPException(400, "You can only enter results for games that have been played")
    for r in g.roster:
        r.goals = max(0, int(body.goals.get(r.id, 0)))
    if body.motm_entry_id and not any(r.id == body.motm_entry_id for r in g.roster):
        raise HTTPException(400, "Man of the match must be on this game's roster")
    result = GameResult(winner=body.winner, score_a=body.score_a, score_b=body.score_b, motm_entry_id=body.motm_entry_id)
    await db.games.update_one({"id": gid}, {"$set": {"result": result.model_dump(),
                                                     "roster": [r.model_dump() for r in g.roster]}})
    return await _get_game(gid)


@router.patch("/games/{gid}", response_model=Game)
async def reschedule_game(gid: str, body: GameUpdate, user: User = Depends(current_user)):
    """Move a game (e.g. ground unavailable on the usual day). Roster is kept."""
    g = await _get_game(gid)
    require_manage(await _get_community(g.community_id), user)
    changes = body.model_dump(exclude_none=True)
    if "date" in changes:
        if changes["date"] < today_iso():
            raise HTTPException(400, "Date must be today or later")
        clash = await db.games.find_one({"community_id": g.community_id, "date": changes["date"], "id": {"$ne": gid}}, {"_id": 1})
        if clash:
            raise HTTPException(409, "Another game is already scheduled on that date")
    if changes:
        await db.games.update_one({"id": gid}, {"$set": changes})
        if "date" in changes or "time" in changes:
            await db.reminders.update_many({"game_id": gid}, {"$set": {k2: changes[k] for k, k2 in
                                            (("date", "game_date"), ("time", "game_time")) if k in changes}})
    return await _get_game(gid)


@router.delete("/games/{gid}")
async def cancel_game(gid: str, user: User = Depends(current_user)):
    g = await _get_game(gid)
    require_manage(await _get_community(g.community_id), user)
    await db.games.delete_one({"id": gid})
    await db.reminders.delete_many({"game_id": gid})
    return {"ok": True}
