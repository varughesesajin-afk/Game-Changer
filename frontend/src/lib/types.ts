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
}

export interface Community extends CommunityCreate {
  id: string;
  owner_id: string;
  owner_name: string;
  members: Member[];
  image: string | null;
  created_at: string;
}

export interface RosterEntry {
  id: string;
  user_id: string | null;
  name: string;
  team: TeamSide;
  added_by: string;
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
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  captain_id: string;
  captain_name: string;
  players: string[];
}

export interface Match {
  id: string;
  round: number;
  slot: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
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
  interval: "month" | "year";
  perks: string[];
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: "paid" | "cancelled";
  mocked: boolean;
  created_at: string;
}
