import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { apiGet } from "@/lib/api";
import TeamBadge from "@/components/TeamBadge";
import TopScorers from "@/components/TopScorers";
import type { StandingsTable, Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Standings tab: league table(s) — points 3/1/0, ordered by points, goal difference, goals scored. */
export default function Standings({ t }: { t: Tournament }) {
  const q = useQuery({ queryKey: ["tournament", t.id, "standings", t.matches.length, t.matches.filter((m) => m.score_a !== null).length], queryFn: () => apiGet<StandingsTable[]>(`/tournaments/${t.id}/standings`) });
  const tables = q.isError ? [] : q.data ?? [];
  const qualifies = (pos: number) =>
    (t.format === "groups_knockout" && pos < t.advance_per_group) || (t.format === "league_playoffs" && pos < t.playoff_teams);

  if (t.format === "other") return <p className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-400">Standings will appear once this custom format is supported.</p>;

  return (
    <div className="space-y-5" data-testid="tournament-standings">
      {t.format === "knockout" && <p className="text-xs text-slate-400">Knockout format — wins and losses from bracket matches.</p>}
      {tables.map((tbl) => (
        <div key={tbl.group ?? "table"} className="overflow-hidden rounded-2xl border border-line bg-surface">
          {tbl.group && <div className="border-b border-line px-3 py-2 font-heading font-bold">Group {tbl.group}</div>}
          <div className="grid grid-cols-[1.25rem_1fr_repeat(6,1.6rem)] items-center gap-x-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>#</span><span>Team</span><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">L</span><span className="text-center">GD</span><span className="text-center">Pts</span>
          </div>
          {tbl.rows.map((r, i) => (
            <div
              key={r.team_id}
              data-testid={`standing-row-${tbl.group ?? "x"}-${i}`}
              className={cn("grid grid-cols-[1.25rem_1fr_repeat(6,1.6rem)] items-center gap-x-1 border-t border-line/60 px-3 py-2 text-sm", qualifies(i) && "bg-energy/10")}
            >
              <span className={cn("font-heading font-bold", qualifies(i) ? "text-energy" : "text-slate-500")}>{i + 1}</span>
              <span className="flex min-w-0 items-center gap-1 truncate font-medium">
                <TeamBadge team={t.teams.find((x) => x.id === r.team_id)} className="size-5" />
                <span className="truncate">{r.team_name}</span>
                {t.champion_id === r.team_id && <Crown className="size-3.5 shrink-0 text-amber-400" />}
              </span>
              <span className="text-center text-slate-300">{r.played}</span>
              <span className="text-center text-slate-300">{r.won}</span>
              <span className="text-center text-slate-300">{r.drawn}</span>
              <span className="text-center text-slate-300">{r.lost}</span>
              <span className="text-center text-slate-300">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</span>
              <span className="text-center font-heading font-bold text-white">{r.points}</span>
            </div>
          ))}
          {tbl.rows.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No teams yet.</div>}
        </div>
      ))}
      {tables.length === 0 && <p className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-400">The table appears once the tournament starts.</p>}
      {(t.format === "groups_knockout" || t.format === "league_playoffs") && <p className="text-xs text-slate-500">Highlighted teams are in the qualifying places for the knockout stage.</p>}
      <TopScorers t={t} />
    </div>
  );
}
