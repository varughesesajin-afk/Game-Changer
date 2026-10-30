import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user, is_admin, optional_user
from lib.community_access import get_community, require_manage
from lib.db import db
from models.schemas import (Match, PlayerIn, ResultIn, StandingRow, StandingsTable, Team, TeamCreate,
                            Tournament, TournamentCreate, User)

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


async def _get(tid: str) -> Tournament:
    doc = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Tournament not found")
    return Tournament(**doc)


async def _save(t: Tournament) -> Tournament:
    await db.tournaments.replace_one({"id": t.id}, t.model_dump())
    return t


def _can_manage(t: Tournament, user: User) -> bool:
    return t.organiser_id == user.user_id or is_admin(user)


def build_bracket(teams: List[Team]) -> List[Match]:
    return build_bracket_ids([t.id for t in teams])


def build_bracket_ids(team_ids: List[str]) -> List[Match]:
    """Single-elimination bracket; seeds in order (1 v last ...), byes auto-advance."""
    n = len(team_ids)
    size = 1 << math.ceil(math.log2(max(n, 2)))
    rounds = int(math.log2(size))
    ids: List[Optional[str]] = list(team_ids) + [None] * (size - n)
    matches: List[Match] = []
    for i in range(size // 2):
        matches.append(Match(round=1, slot=i, team_a_id=ids[i], team_b_id=ids[size - 1 - i]))
    for r in range(2, rounds + 1):
        for s_ in range(size >> r):
            matches.append(Match(round=r, slot=s_))
    for m in [m for m in matches if m.round == 1]:
        if m.team_a_id and not m.team_b_id:
            m.winner_id = m.team_a_id
            _advance(matches, m)
    return matches


def round_robin(team_ids: List[str], legs: int, stage: str, group: Optional[str] = None) -> List[Match]:
    """Circle method: every team plays every other once per leg (second leg swaps home/away)."""
    ids: List[Optional[str]] = list(team_ids)
    if len(ids) % 2:
        ids.append(None)
    n = len(ids)
    out: List[Match] = []
    for leg in range(legs):
        rot = ids[:]
        for r in range(n - 1):
            slot = 0
            for i in range(n // 2):
                a, b = rot[i], rot[n - 1 - i]
                if a and b:
                    if leg % 2:
                        a, b = b, a
                    out.append(Match(stage=stage, group=group, round=leg * (n - 1) + r + 1, slot=slot, team_a_id=a, team_b_id=b))
                    slot += 1
            rot = [rot[0], rot[-1]] + rot[1:-1]
    return out


def _advance(matches: List[Match], m: Match) -> Optional[str]:
    """Push m.winner_id into the next knockout round. Returns champion id if m was the final."""
    nxt = next((x for x in matches if x.stage == "knockout" and x.round == m.round + 1 and x.slot == m.slot // 2), None)
    if not nxt:
        return m.winner_id
    if m.slot % 2 == 0:
        nxt.team_a_id = m.winner_id
    else:
        nxt.team_b_id = m.winner_id
    return None


def compute_standings(t: Tournament) -> List[StandingsTable]:
    """Tables for league/group stages (3 pts win, 1 draw). Knockout-only: one win/loss table."""
    stage = {"league": "league", "league_playoffs": "league", "groups_knockout": "group"}.get(t.format, "knockout")
    names = {x.id: x.name for x in t.teams}
    tables: dict = {}
    for m in t.matches:
        if m.stage != stage:
            continue
        rows = tables.setdefault(m.group, {})
        for tid in (m.team_a_id, m.team_b_id):
            if tid and tid not in rows:
                rows[tid] = StandingRow(team_id=tid, team_name=names.get(tid, "?"))
        if m.score_a is None or m.score_b is None or not (m.team_a_id and m.team_b_id):
            continue
        for tid, gf, ga in ((m.team_a_id, m.score_a, m.score_b), (m.team_b_id, m.score_b, m.score_a)):
            r = rows[tid]
            r.played += 1
            r.goals_for += gf
            r.goals_against += ga
            r.goal_diff = r.goals_for - r.goals_against
            if gf > ga:
                r.won += 1
                r.points += 3
            elif gf == ga:
                r.drawn += 1
                r.points += 1
            else:
                r.lost += 1
    if stage == "knockout" and not tables:
        tables[None] = {x.id: StandingRow(team_id=x.id, team_name=x.name) for x in t.teams}
    return [StandingsTable(group=g, rows=sorted(rows.values(), key=lambda r: (-r.points, -r.goal_diff, -r.goals_for, r.team_name)))
            for g, rows in sorted(tables.items(), key=lambda kv: kv[0] or "")]


def _maybe_start_knockout(t: Tournament) -> None:
    """When the league/group stage is fully played, seed the knockout bracket (or crown the league winner)."""
    stage = "group" if t.format == "groups_knockout" else "league"
    stage_matches = [m for m in t.matches if m.stage == stage]
    if not stage_matches or any(m.score_a is None for m in stage_matches):
        return
    if any(m.stage == "knockout" for m in t.matches):
        return
    tables = compute_standings(t)
    if t.format == "league":
        t.champion_id = tables[0].rows[0].team_id if tables and tables[0].rows else None
        t.status = "completed"
        return
    if t.format == "groups_knockout":
        k = t.advance_per_group
        qualified = [tbl.rows[pos].team_id for pos in range(k) for tbl in tables if pos < len(tbl.rows)]
    else:
        qualified = [r.team_id for r in tables[0].rows[: t.playoff_teams]]
    t.matches.extend(build_bracket_ids(qualified))


@router.get("", response_model=List[Tournament])
async def list_tournaments(kind: Optional[str] = None, sport: Optional[str] = None, status: Optional[str] = None,
                           community_id: Optional[str] = None, mine: bool = False,
                           user: Optional[User] = Depends(optional_user)):
    q: dict = {}
    if kind:
        q["kind"] = kind
    if sport and sport != "All":
        q["sport"] = sport
    if status:
        q["status"] = status
    if community_id:
        q["community_id"] = community_id
    if mine:
        if not user:
            raise HTTPException(401, "Not authenticated")
        q["$or"] = [{"organiser_id": user.user_id}, {"teams.captain_id": user.user_id}]
    docs = await db.tournaments.find(q, {"_id": 0}).sort("start_date", 1).to_list(200)
    return [Tournament(**d) for d in docs]


@router.post("", response_model=Tournament)
async def create_tournament(body: TournamentCreate, user: User = Depends(current_user)):
    community_name = None
    if body.format == "other" and len(body.format_notes.strip()) < 10:
        raise HTTPException(400, "Describe how your format works so the admin can set it up")
    if body.kind == "official":
        if not is_admin(user):
            raise HTTPException(403, "Only platform admins can create official tournaments")
        body.community_id = None
    else:
        if not body.community_id:
            raise HTTPException(400, "Pick the community that hosts this tournament")
        c = await get_community(body.community_id)
        require_manage(c, user)
        community_name = c.name
    t = Tournament(**body.model_dump(), community_name=community_name,
                   organiser_id=user.user_id, organiser_name=user.name)
    await db.tournaments.insert_one(t.model_dump())
    return t


@router.get("/{tid}/standings", response_model=List[StandingsTable])
async def standings(tid: str):
    return compute_standings(await _get(tid))


@router.get("/{tid}", response_model=Tournament)
async def get_tournament(tid: str):
    return await _get(tid)


@router.delete("/{tid}")
async def delete_tournament(tid: str, user: User = Depends(current_user)):
    t = await _get(tid)
    if not _can_manage(t, user):
        raise HTTPException(403, "Not allowed")
    await db.tournaments.delete_one({"id": tid})
    return {"ok": True}


@router.post("/{tid}/teams", response_model=Tournament)
async def register_team(tid: str, body: TeamCreate, user: User = Depends(current_user)):
    t = await _get(tid)
    if t.status != "registration":
        raise HTTPException(400, "Registration is closed")
    if len(t.teams) >= t.max_teams:
        raise HTTPException(409, "Tournament is full")
    if any(x.name.lower() == body.name.strip().lower() for x in t.teams):
        raise HTTPException(409, "Team name already taken")
    players = [p.strip() for p in body.players if p.strip()]
    if user.name not in players:
        players.insert(0, user.name)
    t.teams.append(Team(name=body.name.strip(), captain_id=user.user_id, captain_name=user.name,
                        players=players[: t.team_size * 2]))
    return await _save(t)


@router.post("/{tid}/teams/{team_id}/players", response_model=Tournament)
async def add_player(tid: str, team_id: str, body: PlayerIn, user: User = Depends(current_user)):
    t = await _get(tid)
    team = next((x for x in t.teams if x.id == team_id), None)
    if not team:
        raise HTTPException(404, "Team not found")
    if team.captain_id != user.user_id and not _can_manage(t, user):
        raise HTTPException(403, "Only the captain can add players")
    if len(team.players) >= t.team_size * 2:
        raise HTTPException(409, "Squad is full")
    team.players.append(body.name.strip())
    return await _save(t)


@router.delete("/{tid}/teams/{team_id}", response_model=Tournament)
async def withdraw_team(tid: str, team_id: str, user: User = Depends(current_user)):
    t = await _get(tid)
    team = next((x for x in t.teams if x.id == team_id), None)
    if not team:
        raise HTTPException(404, "Team not found")
    if team.captain_id != user.user_id and not _can_manage(t, user):
        raise HTTPException(403, "Not allowed")
    if t.status != "registration":
        raise HTTPException(400, "Cannot withdraw after the tournament has started")
    t.teams = [x for x in t.teams if x.id != team_id]
    return await _save(t)


@router.post("/{tid}/start", response_model=Tournament)
async def start_tournament(tid: str, user: User = Depends(current_user)):
    t = await _get(tid)
    if not _can_manage(t, user):
        raise HTTPException(403, "Only the organiser can start the tournament")
    if t.status != "registration":
        raise HTTPException(400, "Tournament already started")
    if len(t.teams) < 2:
        raise HTTPException(400, "At least 2 teams are needed")
    ids = [x.id for x in t.teams]
    if t.format == "knockout":
        t.matches = build_bracket(t.teams)
    elif t.format in ("league", "league_playoffs"):
        if t.format == "league_playoffs" and len(ids) < 3:
            raise HTTPException(400, "League + playoffs needs at least 3 teams")
        t.matches = round_robin(ids, t.league_legs, "league")
    elif t.format == "groups_knockout":
        g = max(1, min(t.group_count, len(ids) // 2))
        groups: List[List[str]] = [[] for _ in range(g)]
        for i, tid in enumerate(ids):  # snake draft keeps groups balanced
            row, col = divmod(i, g)
            groups[col if row % 2 == 0 else g - 1 - col].append(tid)
        t.matches = [m for gi, members in enumerate(groups) for m in round_robin(members, t.league_legs, "group", chr(65 + gi))]
    else:  # "other": no automatic fixtures; the admin reviews the requested format
        t.matches = []
    t.status = "ongoing"
    return await _save(t)


@router.post("/{tid}/matches/{mid}/result", response_model=Tournament)
async def report_result(tid: str, mid: str, body: ResultIn, user: User = Depends(current_user)):
    t = await _get(tid)
    if not _can_manage(t, user):
        raise HTTPException(403, "Only the organiser can report results")
    m = next((x for x in t.matches if x.id == mid), None)
    if not m:
        raise HTTPException(404, "Match not found")
    if not (m.team_a_id and m.team_b_id):
        raise HTTPException(400, "Both teams are not decided yet")
    if m.score_a is not None or (m.stage == "knockout" and m.winner_id):
        raise HTTPException(400, "Result already recorded")
    if m.stage == "knockout" and body.score_a == body.score_b:
        raise HTTPException(400, "Knockout matches need a winner (no draws)")
    m.score_a, m.score_b = body.score_a, body.score_b
    m.winner_id = None if body.score_a == body.score_b else (m.team_a_id if body.score_a > body.score_b else m.team_b_id)
    if m.stage == "knockout":
        champ = _advance(t.matches, m)
        if champ:
            t.champion_id = champ
            t.status = "completed"
    else:
        _maybe_start_knockout(t)
    return await _save(t)
