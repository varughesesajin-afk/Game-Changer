import { useQuery } from "@tanstack/react-query";
import { Coins, Flame, Goal, Lock, Medal, Star, Trophy, type LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { BadgesOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { medal: Medal, trophy: Trophy, goal: Goal, star: Star, flame: Flame, coins: Coins };

const isNew = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 3 * 24 * 3600 * 1000;

/** Streak + badges, worked out from played games. Shown on a player's profile. */
export default function BadgesPanel({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ["badges", userId], queryFn: () => apiGet<BadgesOut>(`/badges/${userId}`) });
  const b = q.isError ? undefined : q.data;
  if (!b) return null;
  const next = [5, 10, 25].find((n) => n > b.current_streak) ?? b.current_streak + 5;
  const filled = Math.min(b.current_streak, 5);
  return (
    <section data-testid="badges-panel" className="space-y-3">
      <div className="gradient-card flex items-center gap-3.5 rounded-3xl border-2 border-transparent p-3.5">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 shadow-md shadow-red-500/30">
          <Flame className="size-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div data-testid="streak-count" className="font-heading text-lg font-bold">
            {b.current_streak === 0 ? "No streak yet" : `${b.current_streak} game${b.current_streak === 1 ? "" : "s"} in a row`}
          </div>
          <div className="text-xs text-slate-400">
            {b.current_streak === 0 ? "Play a game to start one" : `${next - b.current_streak} more for ${next} in a row`} · best {b.best_streak}
          </div>
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={cn("h-1.5 w-6 rounded-full", i < filled ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-elevated")} />
            ))}
          </div>
        </div>
      </div>

      <h2 className="font-heading text-lg font-bold">Badges <span className="text-sm font-medium text-slate-400">· {b.earned} of {b.total}</span></h2>
      <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-4 xl:grid-cols-6">
        {b.badges.map((x) => {
          const Icon = x.earned ? ICONS[x.icon] ?? Medal : Lock;
          return (
            <div
              key={x.id}
              data-testid={`badge-${x.id}`}
              title={x.description}
              className={cn("relative rounded-2xl border-2 px-1.5 pb-2 pt-2.5 text-center", x.earned ? "border-line bg-surface" : "border-dashed border-line bg-elevated/60")}
            >
              {x.earned && isNew(x.earned_at) && <span className="absolute right-1.5 top-1.5 rounded-full bg-energy px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">New</span>}
              <div className={cn("mx-auto mb-1.5 grid size-10 place-items-center rounded-full", x.earned ? "bg-brand text-white shadow-md shadow-emerald-500/30" : "bg-line/70 text-slate-500")}>
                <Icon className="size-5" />
              </div>
              <div className={cn("text-[11px] font-bold leading-tight", !x.earned && "text-slate-500")}>{x.name}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">{x.earned ? "Earned" : x.progress > 0 ? `${x.progress} / ${x.target}` : "Locked"}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
