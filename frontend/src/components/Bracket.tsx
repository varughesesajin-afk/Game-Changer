import { useState } from "react";
import { Crown } from "lucide-react";
import MatchDialog from "@/components/MatchDialog";
import { fmtDate } from "@/lib/auth";
import type { Match, Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

function roundName(round: number, total: number): string {
  const left = total - round;
  if (left === 0) return "Final";
  if (left === 1) return "Semi-finals";
  if (left === 2) return "Quarter-finals";
  return `Round ${round}`;
}

export default function Bracket({ t, canManage }: { t: Tournament; canManage: boolean }) {
  const [sel, setSel] = useState<Match | null>(null);
  const name = (id: string | null) => (id ? t.teams.find((x) => x.id === id)?.name ?? "—" : null);
  const ko = t.matches.filter((m) => m.stage === "knockout");
  const rounds = Math.max(0, ...ko.map((m) => m.round));
  const selected = sel ? t.matches.find((m) => m.id === sel.id) ?? null : null;

  if (!ko.length) {
    return (
      <div data-testid="bracket-empty" className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-slate-400">
        The bracket is drawn when the organiser starts the tournament.
      </div>
    );
  }

  return (
    <>
      <div data-testid="tournament-bracket-view" className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
          <div key={r} className="flex w-52 shrink-0 flex-col">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{roundName(r, rounds)}</div>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {ko
                .filter((m) => m.round === r)
                .sort((x, y) => x.slot - y.slot)
                .map((m) => {
                  const ready = !!(m.team_a_id && m.team_b_id) && !m.winner_id;
                  const bye = !!m.winner_id && (!m.team_a_id || !m.team_b_id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      data-testid={`bracket-match-${m.round}-${m.slot}`}
                      disabled={!(m.team_a_id && m.team_b_id)}
                      onClick={() => setSel(m)}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-surface text-left transition-[border-color,transform] duration-200",
                        canManage && ready ? "border-energy/60 hover:-translate-y-0.5 hover:border-energy" : "border-line",
                      )}
                    >
                      {[
                        { id: m.team_a_id, s: m.score_a },
                        { id: m.team_b_id, s: m.score_b },
                      ].map((side, k) => {
                        const won = !!m.winner_id && side.id === m.winner_id;
                        return (
                          <div
                            key={k}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 text-sm",
                              k === 0 && "border-b border-line",
                              won ? "bg-energy/10 font-bold text-white" : m.winner_id ? "text-slate-500" : "text-slate-200",
                            )}
                          >
                            <span className="truncate">{name(side.id) ?? (bye ? "BYE" : "TBD")}</span>
                            <span className="font-heading">{side.s ?? ""}</span>
                          </div>
                        );
                      })}
                      {m.date && (
                        <div className="px-3 py-1 text-[10px] text-slate-400">{fmtDate(m.date, "EEE d MMM")}{m.time ? ` · ${m.time}` : ""}{m.pitch ? ` · ${m.pitch}` : ""}</div>
                      )}
                      {canManage && ready && (
                        <div className="bg-energy/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Tap to report score</div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        {t.champion_id && (
          <div className="flex w-40 shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-center">
            <Crown className="size-8 text-amber-400" />
            <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-amber-300">Champion</div>
            <div data-testid="bracket-champion" className="font-heading text-lg font-bold text-white">{name(t.champion_id)}</div>
          </div>
        )}
      </div>

      <MatchDialog t={t} match={selected} onClose={() => setSel(null)} canManage={canManage} />
    </>
  );
}
