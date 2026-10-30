import type { TournamentFormat } from "./types";

export const FORMATS: { id: TournamentFormat; label: string; desc: string }[] = [
  { id: "league", label: "Pure league", desc: "Every team plays everyone else once (or home & away) in a single table" },
  { id: "knockout", label: "Single-elimination bracket", desc: "Lose once and you're out — straight knockout to the final" },
  { id: "groups_knockout", label: "Group stage + knockout", desc: "Mini-leagues in groups; top finishers advance to a knockout bracket" },
  { id: "league_playoffs", label: "League + playoffs", desc: "One big table, then the top teams go into a playoff bracket" },
  { id: "other", label: "Other", desc: "Describe your format — the app admin will try to make it available" },
];

export const formatLabel = (f: TournamentFormat) => FORMATS.find((x) => x.id === f)?.label ?? f;
