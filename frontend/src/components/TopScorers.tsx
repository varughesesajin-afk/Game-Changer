import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import TeamBadge from "@/components/TeamBadge";
import { apiGet } from "@/lib/api";
import type { ScorerRow, Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TopScorers({ t }: { t: Tournament }) {
  const stamp = t.matches.reduce((n, m) => n + m.goals.length + (m.motm_player ? 1 : 0), 0);
  const q = useQuery({ queryKey: ["tournament", t.id, "scorers", stamp], queryFn: () => apiGet<ScorerRow[]>(`/tournaments/${t.id}/scorers`) });
  const rows = (q.isError ? [] : q.data ?? []).slice(0, 15);
  return (
    <section className="space-y-2" data-testid="tournament-top-scorers">
      <h3 className="font-heading text-lg font-bold">Top scorers</h3>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No goals recorded yet — organisers add scorers in each match.</div>}
        {rows.map((r, i) => (
          <div key={r.team_id + r.player} data-testid={`scorer-row-${i}`} className={cn("flex items-center gap-2.5 px-3 py-2 text-sm", i > 0 && "border-t border-line/60")}>
            <span className={cn("w-5 font-heading font-bold", i === 0 ? "text-amber-400" : "text-slate-500")}>{i + 1}</span>
            <TeamBadge team={t.teams.find((x) => x.id === r.team_id)} className="size-5" />
            <span className="min-w-0 flex-1 truncate"><span className="font-medium text-white">{r.player}</span> <span className="text-xs text-slate-500">{r.team_name}</span></span>
            {r.motm > 0 && <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-300"><Star className="size-3" fill="currentColor" />{r.motm}</span>}
            <span className="w-8 text-right font-heading text-lg font-bold text-energy">{r.goals}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
