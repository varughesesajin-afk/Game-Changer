import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Goal, Medal, Trophy } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Metric = "games" | "wins" | "goals";
const TABS: { id: Metric; label: string; icon: typeof Trophy }[] = [
  { id: "games", label: "Most games", icon: Medal },
  { id: "wins", label: "Most wins", icon: Trophy },
  { id: "goals", label: "Top scorers", icon: Goal },
];

export default function Leaderboard({ communityId }: { communityId: string }) {
  const [metric, setMetric] = useState<Metric>("games");
  const q = useQuery({ queryKey: ["leaderboard", communityId], queryFn: () => apiGet<LeaderboardRow[]>(`/communities/${communityId}/leaderboard`) });
  const rows = (q.isError ? [] : q.data ?? []).filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric] || b.games - a.games).slice(0, 10);

  return (
    <section className="space-y-3" data-testid="community-leaderboard">
      <h2 className="font-heading text-xl font-bold">Leaderboard</h2>
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
        {rows.length === 0 && <div className="p-5 text-center text-sm text-slate-500">No results yet — stats appear after games are played.</div>}
        {rows.map((r, i) => (
          <div
            key={r.key}
            data-testid={`leaderboard-row-${i}`}
            className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", i > 0 && "border-t border-line/60", i === 0 && "bg-gradient-to-r from-amber-400/10 to-transparent")}
          >
            <span className={cn("w-5 text-center font-heading font-bold", i === 0 ? "text-amber-400" : i < 3 ? "text-ice" : "text-slate-500")}>
              {i === 0 ? <Crown className="mx-auto size-4" /> : i + 1}
            </span>
            <span className="flex-1 truncate font-medium text-white">
              {r.name}
              {!r.user_id && <span className="ml-1 text-[10px] text-slate-500">guest</span>}
            </span>
            <span className="font-heading text-lg font-bold text-energy">{r[metric]}</span>
            <span className="w-16 text-right text-[10px] uppercase tracking-[0.12em] text-slate-500">
              {metric === "games" ? `${r.wins}W` : `${r.games} gms`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
