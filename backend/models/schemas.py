"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts. Keep both in sync."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

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
    visibility: Literal["open", "private"] = "open"  # private: only approved members can join matches


class CommunityCreateIn(CommunityCreate):
    pass


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
    image: Optional[str] = None  # "/api/images/<id>" from POST /api/images, or "" to reset to the sport default
    visibility: Optional[Literal["open", "private"]] = None


class Community(CommunityCreate):
    id: str = Field(default_factory=_id)
    owner_id: str
    owner_name: str
    members: List[Member] = Field(default_factory=list)
    join_requests: List[Member] = Field(default_factory=list)  # pending host approval
    manage_until: Optional[str] = None  # YYYY-MM-DD; paid through this date (each OMR 1 adds 30 days)
    trial_until: Optional[str] = None  # YYYY-MM-DD; 15-day free Manage trial from creation (no premium)
    manage_active: bool = False  # computed on read: paid or in trial
    premium_active: bool = False  # computed on read: paid only (tournaments + gallery uploads)
    in_trial: bool = False  # computed on read
    season_length: Literal["manual", "month", "quarter"] = "manual"
    season_start: Optional[str] = None  # set by "start new season now"
    created_at: datetime = Field(default_factory=_now)


# ---------- games (one dated occurrence of a recurring community session) ----------
class RosterEntry(BaseModel):
    id: str = Field(default_factory=_id)
    user_id: Optional[str] = None
    name: str
    team: Literal["A", "B"] = "A"
    added_by: str
    picture: Optional[str] = None
    paid: bool = False
    goals: int = 0
    late: bool = False  # ticked on the match sheet


JERSEY_COLOURS = ["White", "Black", "Red", "Blue", "Navy", "Sky", "Green", "Yellow", "Orange", "Purple", "Maroon", "Grey"]
Jersey = Optional[Literal["White", "Black", "Red", "Blue", "Navy", "Sky", "Green", "Yellow", "Orange", "Purple", "Maroon", "Grey"]]


class GameCreate(BaseModel):
    date: str  # YYYY-MM-DD
    time: Optional[str] = None
    venue: Optional[str] = None
    jersey_a: Jersey = None  # host-chosen kit colour per side
    jersey_b: Jersey = None


class GameUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None
    jersey_a: Jersey = None
    jersey_b: Jersey = None


class GameGoal(BaseModel):
    team: Literal["A", "B"]
    scorer_id: Optional[str] = None  # roster entry id; None = unassigned goal
    assist_id: Optional[str] = None


class GameResult(BaseModel):
    winner: Literal["A", "B", "draw"]
    score_a: Optional[int] = Field(None, ge=0)
    score_b: Optional[int] = Field(None, ge=0)
    motm_entry_id: Optional[str] = None  # man of the match (roster entry id)
    events: List[GameGoal] = Field(default_factory=list)  # match-sheet goals in order


class GameSheetIn(BaseModel):
    events: List[GameGoal] = Field(default_factory=list)
    late_ids: List[str] = Field(default_factory=list)
    paid_ids: List[str] = Field(default_factory=list)
    motm_entry_id: Optional[str] = None


class GameResultIn(GameResult):
    goals: Dict[str, int] = Field(default_factory=dict)  # roster entry id -> goals/points


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
    result: Optional[GameResult] = None
    jersey_a: Jersey = None
    jersey_b: Jersey = None
    created_at: datetime = Field(default_factory=_now)


class GameNotice(BaseModel):
    game: Game
    when: Literal["today", "tomorrow"]


class LeaderboardRow(BaseModel):
    key: str
    name: str
    user_id: Optional[str] = None
    picture: Optional[str] = None
    games: int
    wins: int
    goals: int
    motm: int = 0


class Leaderboard(BaseModel):
    scope: Literal["season", "all"]
    season_label: str
    season_start: Optional[str] = None
    rows: List[LeaderboardRow]


class SeasonIn(BaseModel):
    season_length: Literal["manual", "month", "quarter"]
    start_now: bool = False


class PlayerCommunityStats(BaseModel):
    community_id: str
    community_name: str
    sport: str
    games: int
    wins: int
    goals: int
    motm: int


class PlayerGameLine(BaseModel):
    game_id: str
    community_id: str
    community_name: str
    sport: str
    date: str
    team: Literal["A", "B"]
    goals: int
    outcome: Literal["won", "lost", "draw", "pending"]
    motm: bool


class PlayerProfile(BaseModel):
    key: str
    name: str
    user_id: Optional[str] = None
    picture: Optional[str] = None
    totals: PlayerCommunityStats
    communities: List[PlayerCommunityStats]
    recent: List[PlayerGameLine]


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
    logo: Optional[str] = None


class MatchGoal(BaseModel):
    team_id: str
    player: str
    goals: int = Field(ge=0)


class SheetGoal(BaseModel):
    team_id: str
    scorer: Optional[str] = None  # squad name; None = unassigned goal
    assist: Optional[str] = None


class Match(BaseModel):
    id: str = Field(default_factory=_id)
    stage: Literal["league", "group", "knockout"] = "knockout"
    group: Optional[str] = None  # "A", "B"... for group stage
    round: int  # matchday for league/group, bracket round for knockout
    slot: int
    team_a_id: Optional[str] = None
    team_b_id: Optional[str] = None
    score_a: Optional[int] = None
    score_b: Optional[int] = None
    winner_id: Optional[str] = None
    date: Optional[str] = None  # scheduled kick-off
    time: Optional[str] = None
    pitch: Optional[str] = None
    jersey_a: Jersey = None
    jersey_b: Jersey = None
    goals: List[MatchGoal] = Field(default_factory=list)
    motm_team_id: Optional[str] = None
    motm_player: Optional[str] = None
    events: List[SheetGoal] = Field(default_factory=list)  # match-sheet goals with assists
    late: Dict[str, List[str]] = Field(default_factory=dict)  # team_id -> late squad names
    paid: Dict[str, List[str]] = Field(default_factory=dict)  # team_id -> paid squad names


class MatchSheetIn(BaseModel):
    events: List[SheetGoal] = Field(default_factory=list)
    late: Dict[str, List[str]] = Field(default_factory=dict)
    paid: Dict[str, List[str]] = Field(default_factory=dict)
    motm_team_id: Optional[str] = None
    motm_player: Optional[str] = None


class MatchScheduleIn(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    pitch: Optional[str] = Field(None, max_length=60)
    jersey_a: Jersey = None
    jersey_b: Jersey = None


class MatchStatsIn(BaseModel):
    goals: List[MatchGoal] = Field(default_factory=list)
    motm_team_id: Optional[str] = None
    motm_player: Optional[str] = None


class TeamLogoIn(BaseModel):
    logo: Optional[str] = None  # "/api/images/<id>" or None to remove


class ScorerRow(BaseModel):
    player: str
    team_id: str
    team_name: str
    goals: int
    motm: int


TournamentFormat = Literal["league", "knockout", "groups_knockout", "league_playoffs", "other"]


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
    format: TournamentFormat = "knockout"
    league_legs: int = Field(1, ge=1, le=2)  # 2 = home & away
    group_count: int = Field(2, ge=1, le=16)
    advance_per_group: int = Field(2, ge=1, le=8)
    playoff_teams: int = Field(4, ge=2, le=32)  # league + playoffs: top N go to the bracket
    format_notes: str = Field("", max_length=1000)  # required for "other"


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


# ---------- billing (Thawani Pay checkout, one-time OMR 1 per community) ----------
class CheckoutStart(BaseModel):
    ref: str
    redirect_url: str


class CheckoutStatus(BaseModel):
    ref: str
    community_id: str
    community_name: str
    payment_status: str  # Thawani: "paid" | "unpaid" | other
    paid: bool


class Plan(BaseModel):
    id: str
    name: str
    price: float
    currency: str
    interval: Literal["month", "year", "one_time"]
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


class StandingRow(BaseModel):
    team_id: str
    team_name: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_diff: int = 0
    points: int = 0


class StandingsTable(BaseModel):
    group: Optional[str] = None
    rows: List[StandingRow]


class AdminOverview(BaseModel):
    stats: AdminStats
    users: List[AdminUser]
    communities: List[Community]
    payments: List[PaymentRecord]
    custom_formats: List["Tournament"] = Field(default_factory=list)  # "other" format requests to review


# ---------- in-app fee reminders ----------
class Reminder(BaseModel):
    id: str = Field(default_factory=_id)
    user_id: str
    game_id: str
    community_id: str
    community_name: str
    game_date: str
    game_time: str = ""
    amount: float
    currency: str = "OMR"
    sent_by: str = ""
    dismissed: bool = False
    created_at: datetime = Field(default_factory=_now)

    @staticmethod
    def new_id() -> str:
        return _id()


class RemindResult(BaseModel):
    reminded: int
    skipped_guests: int


class UnpaidPlayer(BaseModel):
    entry_id: str
    name: str
    user_id: Optional[str] = None  # None = guest name, can't be reminded in-app
    reminded: bool = False  # an active (not dismissed) reminder exists


class UnpaidGame(BaseModel):
    game_id: str
    date: str
    time: str
    fee: float
    players: List[UnpaidPlayer]


# ---------- uploaded images ----------
class ImageUploadIn(BaseModel):
    data_url: str  # data:image/jpeg;base64,... (client resizes before upload)


class ImageUploadOut(BaseModel):
    id: str
    url: str


# ---------- gallery & profile picture ----------
class GalleryPhotoIn(BaseModel):
    url: str  # from POST /api/images
    caption: str = Field("", max_length=140)


class GalleryPhoto(GalleryPhotoIn):
    id: str = Field(default_factory=_id)
    community_id: str
    uploaded_by: str
    uploaded_by_name: str
    created_at: datetime = Field(default_factory=_now)


class PictureIn(BaseModel):
    picture: Optional[str] = None  # "/api/images/<id>", or None to go back to the Google photo / initial


AdminOverview.model_rebuild()
