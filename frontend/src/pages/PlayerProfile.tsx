import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Goal, Medal, Star, Trophy } from "lucide-react";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/auth";
import type { PlayerProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const OUTCOME = {
  won: { label: "W", cls: "bg-energy/20 text-energy" },
  lost: { label: "L", cls: "bg-red-400/15 text-red-300" },
  draw: { label: "D", cls: "bg-slate-500/20 text-slate-300" },
  pending: { label: "–", cls: "bg-elevated text-slate-500" },
};

export default function PlayerProfilePage() {
  const { key = "" } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const cid = params.get("community_id");
  const q = useQuery({
    queryKey: ["player", key, cid],
    queryFn: () => apiGet<PlayerProfile>(`/players/${encodeURIComponent(key)}${cid ? `?community_id=${cid}` : ""}`),
  });
  const p = q.isError ? undefined : q.data;

  return (
    <div className="space-y-6 px-5 pt-5 lg:mx-auto lg:max-w-3xl lg:px-6 lg:pt-10" data-testid="player-profile">
      <button type="button" data-testid="back-button" onClick={() => nav(-1)} aria-label="Back" className="rounded-full bg-surface p-2 transition-colors hover:bg-elevated">
        <ArrowLeft className="size-5" />
      </button>
      {q.isError && <p className="text-sm text-slate-400">Player not found.</p>}
      {p && (
        <>
          <div className="flex items-center gap-4">
            {p.picture ? (
              <img src={p.picture} alt="" className="size-16 rounded-2xl object-cover" />
            ) : (
              <div className="grid size-16 place-items-center rounded-2xl bg-brand font-heading text-2xl font-bold text-white">{p.name[0]}</div>
            )}
            <div className="min-w-0">
              <h1 data-testid="player-name" className="truncate font-heading text-3xl font-bold">{p.name}</h1>
              <div className="text-xs text-slate-400">{p.user_id ? `${p.communities.length} ${p.communities.length === 1 ? "community" : "communities"}` : `Guest player · ${p.communities[0]?.community_name ?? ""}`}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Medal, label: "Games", value: p.totals.games },
              { icon: Trophy, label: "Wins", value: p.totals.wins },
              { icon: Goal, label: "Goals", value: p.totals.goals },
              { icon: Star, label: "MOTM", value: p.totals.motm },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} data-testid={`player-total-${label.toLowerCase()}`} className="rounded-xl border border-line bg-surface p-2.5 text-center">
                <Icon className={cn("mx-auto size-4", label === "MOTM" ? "text-amber-400" : "text-ice")} />
                <div className="mt-1 font-heading text-2xl font-bold">{value}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          {p.totals.games > 0 && (
            <div className="text-sm text-slate-400">
              Win rate <span className="font-semibold text-white">{Math.round((p.totals.wins / p.totals.games) * 100)}%</span> ·{" "}
              <span className="font-semibold text-white">{(p.totals.goals / p.totals.games).toFixed(1)}</span> goals per game
            </div>
          )}

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold">By community</h2>
            {p.communities.map((c) => (
              <Link key={c.community_id} to={`/communities/${c.community_id}`} data-testid={`player-community-${c.community_id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 transition-[border-color] hover:border-ice/50">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.community_name}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-ice">{c.sport}</div>
                </div>
                <div className="shrink-0 text-xs text-slate-300">
                  {c.games} gms · {c.wins} W · {c.goals} G{c.motm ? ` · ${c.motm}★` : ""}
                </div>
              </Link>
            ))}
          </section>

          <section className="space-y-2 pb-4">
            <h2 className="font-heading text-lg font-bold">Recent games</h2>
            {p.recent.map((g) => (
              <div key={g.game_id} data-testid={`player-game-${g.game_id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg font-heading text-xs font-bold", OUTCOME[g.outcome].cls)}>{OUTCOME[g.outcome].label}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.community_name}</div>
                  <div className="text-xs text-slate-400">{fmtDate(g.date, "EEE d MMM")} · Team {g.team}</div>
                </div>
                {g.motm && <Star className="size-4 shrink-0 text-amber-400" fill="currentColor" />}
                <span className="shrink-0 font-heading font-bold text-energy">{g.goals} G</span>
              </div>
            ))}
            {p.recent.length === 0 && <p className="text-sm text-slate-500">No games played yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}
