import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user, is_admin, optional_user
from lib.community_access import get_community, require_manage
from lib.db import db
from models.schemas import (Match, PlayerIn, ResultIn, Team, TeamCreate, Tournament,
                            TournamentCreate, User)

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
    n = len(teams)
    size = 1 << math.ceil(math.log2(n))
    rounds = int(math.log2(size))
    ids: List[Optional[str]] = [t.id for t in teams] + [None] * (size - n)
    matches: List[Match] = []
    for i in range(size // 2):
        matches.append(Match(round=1, slot=i, team_a_id=ids[i], team_b_id=ids[size - 1 - i]))
    for r in range(2, rounds + 1):
        for s in range(size >> r):
            matches.append(Match(round=r, slot=s))
    # auto-advance byes
    for m in [m for m in matches if m.round == 1]:
        if m.team_a_id and not m.team_b_id:
            m.winner_id = m.team_a_id
            _advance(matches, m)
    return matches


def _advance(matches: List[Match], m: Match) -> Optional[str]:
    """Push m.winner_id into the next round. Returns champion id if m was the final."""
    nxt = next((x for x in matches if x.round == m.round + 1 and x.slot == m.slot // 2), None)
    if not nxt:
        return m.winner_id
    if m.slot % 2 == 0:
        nxt.team_a_id = m.winner_id
    else:
        nxt.team_b_id = m.winner_id
    return None


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
    t.matches = build_bracket(t.teams)
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
    if m.winner_id:
        raise HTTPException(400, "Result already recorded")
    if body.score_a == body.score_b:
        raise HTTPException(400, "Knockout matches need a winner (no draws)")
    m.score_a, m.score_b = body.score_a, body.score_b
    m.winner_id = m.team_a_id if body.score_a > body.score_b else m.team_b_id
    champ = _advance(t.matches, m)
    if champ:
        t.champion_id = champ
        t.status = "completed"
    return await _save(t)
