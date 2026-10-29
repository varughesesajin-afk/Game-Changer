import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Crown, Goal, Medal, Star, Trophy } from "lucide-react";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/auth";
import type { Leaderboard as LeaderboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type Metric = "games" | "wins" | "goals" | "motm";
const TABS: { id: Metric; label: string; icon: typeof Trophy }[] = [
  { id: "games", label: "Games", icon: Medal },
  { id: "wins", label: "Wins", icon: Trophy },
  { id: "goals", label: "Scorers", icon: Goal },
  { id: "motm", label: "MOTM", icon: Star },
];

export default function Leaderboard({ communityId }: { communityId: string }) {
  const [metric, setMetric] = useState<Metric>("games");
  const [scope, setScope] = useState<"season" | "all">("season");
  const q = useQuery({
    queryKey: ["leaderboard", communityId, scope],
    queryFn: () => apiGet<LeaderboardData>(`/communities/${communityId}/leaderboard?scope=${scope}`),
  });
  const data = q.isError ? undefined : q.data;
  const rows = (data?.rows ?? []).filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric] || b.games - a.games).slice(0, 10);

  return (
    <section className="space-y-3" data-testid="community-leaderboard">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-bold">Leaderboard</h2>
          <div data-testid="leaderboard-season-label" className="text-xs text-slate-400">
            {data ? data.season_label : "…"}
            {data?.season_start && scope === "season" && !data.season_label.startsWith("Since") ? ` · from ${fmtDate(data.season_start, "d MMM")}` : ""}
          </div>
        </div>
        <div className="flex rounded-full border border-line bg-surface p-0.5 text-xs font-semibold">
          {(["season", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`leaderboard-scope-${s}`}
              onClick={() => setScope(s)}
              className={cn("rounded-full px-3 py-1 transition-[background-color,color] duration-150", scope === s ? "bg-elevated text-white" : "text-slate-400")}
            >
              {s === "season" ? "This season" : "All time"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`leaderboard-tab-${id}`}
            onClick={() => setMetric(id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1.5 text-xs font-semibold transition-[background-color,color,border-color] duration-150",
              metric === id ? "border-transparent bg-brand text-white" : "border-line bg-surface text-slate-300",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.length === 0 && <div className="p-5 text-center text-sm text-slate-500">No results yet this {scope === "season" ? "season" : "time"} — stats appear after games are played.</div>}
        {rows.map((r, i) => (
          <Link
            key={r.key}
            to={`/players/${encodeURIComponent(r.key)}${r.user_id ? "" : `?community_id=${communityId}`}`}
            data-testid={`leaderboard-row-${i}`}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-sm transition-[background-color] duration-150 hover:bg-elevated/60",
              i > 0 && "border-t border-line/60",
              i === 0 && "bg-gradient-to-r from-amber-400/10 to-transparent",
            )}
          >
            <span className={cn("w-5 text-center font-heading font-bold", i === 0 ? "text-amber-400" : i < 3 ? "text-ice" : "text-slate-500")}>
              {i === 0 ? <Crown className="mx-auto size-4" /> : i + 1}
            </span>
            <span className="flex flex-1 items-center gap-1.5 truncate font-medium text-white">
              <span className="truncate">{r.name}</span>
              {!r.user_id && <span className="text-[10px] text-slate-500">guest</span>}
              {r.motm > 0 && (
                <span data-testid={`motm-badge-${i}`} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  <Star className="size-3" fill="currentColor" />{r.motm}
                </span>
              )}
            </span>
            <span className="font-heading text-lg font-bold text-energy">{r[metric]}</span>
            <ChevronRight className="size-4 text-slate-600" />
          </Link>
        ))}
      </div>
    </section>
  );
}
