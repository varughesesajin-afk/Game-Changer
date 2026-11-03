// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "admin" | "user";
export type TeamSide = "A" | "B";
export type TournamentKind = "official" | "community";
export type TournamentStatus = "registration" | "ongoing" | "completed";

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
  is_pro: boolean;
  pro_plan: string | null;
  pro_until: string | null;
}

export interface Member {
  user_id: string;
  name: string;
  picture: string | null;
}

export interface CommunityCreate {
  name: string;
  sport: string;
  city: string;
  venue: string;
  description: string;
  days: string[];
  time: string;
  max_players: number;
  fee: number;
  image?: string | null;
  visibility: Visibility;
}

export type Visibility = "open" | "private";

export interface Community extends CommunityCreate {
  id: string;
  owner_id: string;
  owner_name: string;
  members: Member[];
  join_requests: Member[];
  image: string | null;
  manage_until: string | null;
  trial_until: string | null;
  manage_active: boolean;
  premium_active: boolean;
  in_trial: boolean;
  season_length: SeasonLength;
  season_start: string | null;
  created_at: string;
}

export type SeasonLength = "manual" | "month" | "quarter";

export interface SeasonIn {
  season_length: SeasonLength;
  start_now: boolean;
}

export type CommunityUpdate = Partial<Omit<CommunityCreate, "image">> & { image?: string | null };

export interface RosterEntry {
  id: string;
  user_id: string | null;
  name: string;
  team: TeamSide;
  added_by: string;
  picture: string | null;
  paid: boolean;
  goals: number;
  late: boolean;
}

export interface GameResult {
  winner: TeamSide | "draw";
  score_a: number | null;
  score_b: number | null;
  motm_entry_id: string | null;
  events: GameGoal[];
}

export interface GameGoal {
  team: TeamSide;
  scorer_id: string | null;
  assist_id: string | null;
}

export interface GameSheetIn {
  events: GameGoal[];
  late_ids: string[];
  paid_ids: string[];
  motm_entry_id: string | null;
}

export interface GameResultIn extends GameResult {
  goals: Record<string, number>;
}

export interface Game {
  id: string;
  community_id: string;
  community_name: string;
  sport: string;
  date: string;
  time: string;
  venue: string;
  max_players: number;
  fee: number;
  roster: RosterEntry[];
  result: GameResult | null;
  jersey_a: Jersey;
  jersey_b: Jersey;
  created_at: string;
}

export interface GameNotice {
  game: Game;
  when: "today" | "tomorrow";
}

export interface LeaderboardRow {
  key: string;
  name: string;
  user_id: string | null;
  picture: string | null;
  games: number;
  wins: number;
  goals: number;
  motm: number;
}

export interface Leaderboard {
  scope: "season" | "all";
  season_label: string;
  season_start: string | null;
  rows: LeaderboardRow[];
}

export interface PlayerCommunityStats {
  community_id: string;
  community_name: string;
  sport: string;
  games: number;
  wins: number;
  goals: number;
  motm: number;
}

export interface PlayerGameLine {
  game_id: string;
  community_id: string;
  community_name: string;
  sport: string;
  date: string;
  team: TeamSide;
  goals: number;
  outcome: "won" | "lost" | "draw" | "pending";
  motm: boolean;
}

export interface PlayerProfile {
  key: string;
  name: string;
  user_id: string | null;
  picture: string | null;
  totals: PlayerCommunityStats;
  communities: PlayerCommunityStats[];
  recent: PlayerGameLine[];
}

export interface Team {
  id: string;
  name: string;
  captain_id: string;
  captain_name: string;
  players: string[];
  logo: string | null;
}

export interface Match {
  id: string;
  stage: "league" | "group" | "knockout";
  group: string | null;
  round: number;
  slot: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  date: string | null;
  time: string | null;
  pitch: string | null;
  jersey_a: Jersey;
  jersey_b: Jersey;
  goals: MatchGoal[];
  motm_team_id: string | null;
  motm_player: string | null;
  events: SheetGoal[];
  late: Record<string, string[]>;
  paid: Record<string, string[]>;
}

export interface SheetGoal {
  team_id: string;
  scorer: string | null;
  assist: string | null;
}

export interface MatchSheetIn {
  events: SheetGoal[];
  late: Record<string, string[]>;
  paid: Record<string, string[]>;
  motm_team_id: string | null;
  motm_player: string | null;
}

export interface MatchGoal {
  team_id: string;
  player: string;
  goals: number;
}

export interface MatchScheduleIn {
  date: string | null;
  time: string | null;
  pitch: string | null;
  jersey_a: Jersey;
  jersey_b: Jersey;
}

export interface MatchStatsIn {
  goals: MatchGoal[];
  motm_team_id: string | null;
  motm_player: string | null;
}

export interface TeamLogoIn {
  logo: string | null;
}

export interface ScorerRow {
  player: string;
  team_id: string;
  team_name: string;
  goals: number;
  motm: number;
}

export interface TournamentCreate {
  title: string;
  sport: string;
  kind: TournamentKind;
  community_id?: string | null;
  venue: string;
  city: string;
  start_date: string;
  entry_fee: number;
  prize_pool: number;
  max_teams: number;
  team_size: number;
  description: string;
  image?: string | null;
  format: TournamentFormat;
  league_legs: number;
  group_count: number;
  advance_per_group: number;
  playoff_teams: number;
  format_notes: string;
}

export type TournamentFormat = "league" | "knockout" | "groups_knockout" | "league_playoffs" | "other";

export interface StandingRow {
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export interface StandingsTable {
  group: string | null;
  rows: StandingRow[];
}

export interface Tournament extends TournamentCreate {
  id: string;
  community_id: string | null;
  community_name: string | null;
  organiser_id: string;
  organiser_name: string;
  currency: string;
  status: TournamentStatus;
  teams: Team[];
  matches: Match[];
  champion_id: string | null;
  image: string | null;
  created_at: string;
}

export interface Feed {
  official: Tournament[];
  community_tournaments: Tournament[];
  upcoming_games: Game[];
  communities: Community[];
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year" | "one_time";
  perks: string[];
}

export interface CheckoutStart {
  ref: string;
  redirect_url: string;
}

export interface CheckoutStatus {
  ref: string;
  community_id: string;
  community_name: string;
  payment_status: string;
  paid: boolean;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  user_name: string;
  community_id: string | null;
  community_name: string | null;
  plan_id: string;
  amount: number;
  currency: string;
  status: "paid" | "cancelled";
  mocked: boolean;
  created_at: string;
}

export interface AdminStats {
  users: number;
  communities: number;
  managed_communities: number;
  tournaments: number;
  upcoming_games: number;
  revenue_total: number;
  revenue_30d: number;
  currency: string;
}

export interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
  communities_owned: number;
}

export interface AdminOverview {
  stats: AdminStats;
  users: AdminUser[];
  communities: Community[];
  payments: PaymentRecord[];
  custom_formats: Tournament[];
}

export interface Reminder {
  id: string;
  user_id: string;
  game_id: string;
  community_id: string;
  community_name: string;
  game_date: string;
  game_time: string;
  amount: number;
  currency: string;
  sent_by: string;
  dismissed: boolean;
  created_at: string;
}

export interface RemindResult {
  reminded: number;
  skipped_guests: number;
}

export interface ImageUploadIn {
  data_url: string;
}

export interface ImageUploadOut {
  id: string;
  url: string;
}

export type Jersey = "White" | "Black" | "Red" | "Blue" | "Navy" | "Sky" | "Green" | "Yellow" | "Orange" | "Purple" | "Maroon" | "Grey" | null;

export interface GameCreate {
  date: string;
  time?: string | null;
  venue?: string | null;
  jersey_a?: Jersey;
  jersey_b?: Jersey;
}

export interface GameUpdate {
  date?: string | null;
  time?: string | null;
  venue?: string | null;
  jersey_a?: Jersey;
  jersey_b?: Jersey;
}

export interface UnpaidPlayer {
  entry_id: string;
  name: string;
  user_id: string | null;
  reminded: boolean;
}

export interface UnpaidGame {
  game_id: string;
  date: string;
  time: string;
  fee: number;
  players: UnpaidPlayer[];
}

export interface GalleryPhotoIn {
  url: string;
  caption: string;
}

export interface GalleryPhoto extends GalleryPhotoIn {
  id: string;
  community_id: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface PictureIn {
  picture: string | null;
}
