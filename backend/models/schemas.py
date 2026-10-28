"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts. Keep both in sync."""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- users / auth ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Literal["admin", "user"] = "user"
    is_pro: bool = False
    pro_plan: Optional[str] = None
    pro_until: Optional[str] = None


class SessionIn(BaseModel):
    session_id: str


# ---------- communities ----------
class Member(BaseModel):
    user_id: str
    name: str
    picture: Optional[str] = None


class CommunityCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    sport: str
    city: str = ""
    venue: str = ""
    description: str = ""
    days: List[str] = Field(default_factory=list)
    time: str = "19:00"
    max_players: int = Field(14, ge=2, le=200)
    fee: float = Field(0.0, ge=0)
    image: Optional[str] = None


class CommunityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    sport: Optional[str] = None
    city: Optional[str] = None
    venue: Optional[str] = None
    description: Optional[str] = None
    days: Optional[List[str]] = None
    time: Optional[str] = None
    max_players: Optional[int] = Field(None, ge=2, le=200)
    fee: Optional[float] = Field(None, ge=0)


class Community(CommunityCreate):
    id: str = Field(default_factory=_id)
    owner_id: str
    owner_name: str
    members: List[Member] = Field(default_factory=list)
    manage_until: Optional[str] = None  # YYYY-MM-DD; Manage subscription paid through this date
    manage_active: bool = False  # computed on read, never trusted from storage
    created_at: datetime = Field(default_factory=_now)


# ---------- games (one dated occurrence of a recurring community session) ----------
class RosterEntry(BaseModel):
    id: str = Field(default_factory=_id)
    user_id: Optional[str] = None
    name: str
    team: Literal["A", "B"] = "A"
    added_by: str
    paid: bool = False


class GameCreate(BaseModel):
    date: str  # YYYY-MM-DD
    time: Optional[str] = None


class Game(BaseModel):
    id: str = Field(default_factory=_id)
    community_id: str
    community_name: str
    sport: str
    date: str
    time: str
    venue: str = ""
    max_players: int
    fee: float = 0.0
    roster: List[RosterEntry] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)


class JoinGameIn(BaseModel):
    team: Literal["A", "B"] = "A"


class PaidIn(BaseModel):
    paid: bool


class GuestIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    team: Literal["A", "B"] = "A"


# ---------- tournaments ----------
class Team(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    captain_id: str
    captain_name: str
    players: List[str] = Field(default_factory=list)


class Match(BaseModel):
    id: str = Field(default_factory=_id)
    round: int
    slot: int
    team_a_id: Optional[str] = None
    team_b_id: Optional[str] = None
    score_a: Optional[int] = None
    score_b: Optional[int] = None
    winner_id: Optional[str] = None


class TournamentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    sport: str
    kind: Literal["official", "community"] = "community"
    community_id: Optional[str] = None
    venue: str = ""
    city: str = ""
    start_date: str
    entry_fee: float = Field(0.0, ge=0)
    prize_pool: float = Field(0.0, ge=0)
    max_teams: int = Field(8, ge=2, le=64)
    team_size: int = Field(5, ge=1, le=30)
    description: str = ""
    image: Optional[str] = None


class Tournament(TournamentCreate):
    id: str = Field(default_factory=_id)
    community_name: Optional[str] = None
    organiser_id: str
    organiser_name: str
    currency: str = "OMR"
    status: Literal["registration", "ongoing", "completed"] = "registration"
    teams: List[Team] = Field(default_factory=list)
    matches: List[Match] = Field(default_factory=list)
    champion_id: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    players: List[str] = Field(default_factory=list)


class PlayerIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class ResultIn(BaseModel):
    score_a: int = Field(ge=0)
    score_b: int = Field(ge=0)


# ---------- feed ----------
class Feed(BaseModel):
    official: List[Tournament]
    community_tournaments: List[Tournament]
    upcoming_games: List[Game]
    communities: List[Community]


# ---------- billing (MOCKED payments) ----------
class Plan(BaseModel):
    id: str
    name: str
    price: float
    currency: str
    interval: Literal["month", "year"]
    perks: List[str]


class PaymentRecord(BaseModel):
    id: str = Field(default_factory=_id)
    user_id: str
    user_name: str = ""
    community_id: Optional[str] = None
    community_name: Optional[str] = None
    plan_id: str
    amount: float
    currency: str
    status: Literal["paid", "cancelled"] = "paid"
    mocked: bool = True
    created_at: datetime = Field(default_factory=_now)


# ---------- admin ----------
class AdminStats(BaseModel):
    users: int
    communities: int
    managed_communities: int
    tournaments: int
    upcoming_games: int
    revenue_total: float
    revenue_30d: float
    currency: str = "OMR"


class AdminUser(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    communities_owned: int


class AdminOverview(BaseModel):
    stats: AdminStats
    users: List[AdminUser]
    communities: List[Community]
    payments: List[PaymentRecord]
