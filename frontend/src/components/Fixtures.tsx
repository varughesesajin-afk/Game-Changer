import { useState } from "react";
import Bracket from "@/components/Bracket";
import MatchDialog from "@/components/MatchDialog";
import TeamBadge from "@/components/TeamBadge";
import { fmtDate } from "@/lib/auth";
import type { Match, Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Fixtures tab: league / group matchdays (draws allowed) followed by the knockout bracket. */
export default function Fixtures({ t, canManage }: { t: Tournament; canManage: boolean }) {
  const [sel, setSel] = useState<Match | null>(null);
  const name = (id: string | null) => (id ? t.teams.find((x) => x.id === id)?.name ?? "—" : "TBD");
  const table = t.matches.filter((m) => m.stage !== "knockout");
  const hasKnockout = t.format !== "league" && t.format !== "other";
  const groups = Array.from(new Set(table.map((m) => m.group ?? ""))).sort();

  const selected = sel ? t.matches.find((m) => m.id === sel.id) ?? null : null;

  if (t.format === "other") {
    return (
      <div data-testid="fixtures-custom-format" className="space-y-2 rounded-2xl border border-dashed border-line p-5 text-sm text-slate-300">
        <div className="font-semibold text-white">Custom format</div>
        <p className="whitespace-pre-line">{t.format_notes}</p>
        <p className="text-xs text-slate-500">The app admin is reviewing this format. Fixtures will appear here once it's supported.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tournament-fixtures">
      {t.status === "registration" && (
        <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-400">Fixtures are generated when the organiser starts the tournament.</div>
      )}
      {groups.map((g) => {
        const ms = table.filter((m) => (m.group ?? "") === g);
        const days = Array.from(new Set(ms.map((m) => m.round))).sort((x, y) => x - y);
        return (
          <section key={g || "league"} className="space-y-3">
            <h3 className="font-heading text-lg font-bold">{g ? `Group ${g}` : "League fixtures"}</h3>
            {days.map((d) => (
              <div key={d} className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Matchday {d}</div>
                {ms.filter((m) => m.round === d).map((m) => {
                  const played = m.score_a !== null && m.score_b !== null;
                  const can = canManage && !played;
                  const ta = t.teams.find((x) => x.id === m.team_a_id);
                  const tb = t.teams.find((x) => x.id === m.team_b_id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      data-testid={`fixture-${m.id}`}
                      onClick={() => setSel(m)}
                      className={cn(
                        "grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm transition-[border-color] duration-150",
                        can ? "border-energy/50 hover:border-energy" : "border-line",
                      )}
                    >
                      <span className={cn("flex min-w-0 items-center gap-1.5 text-left", played && (m.score_a ?? 0) > (m.score_b ?? 0) && "font-bold text-white")}><TeamBadge team={ta} className="size-5" /><span className="truncate">{name(m.team_a_id)}</span></span>
                      <span className="min-w-14 rounded-md bg-elevated px-2 py-0.5 text-center font-heading font-bold">
                        {played ? `${m.score_a} – ${m.score_b}` : can ? "Score" : "vs"}
                      </span>
                      <span className={cn("flex min-w-0 items-center justify-end gap-1.5 text-right", played && (m.score_b ?? 0) > (m.score_a ?? 0) && "font-bold text-white")}><span className="truncate">{name(m.team_b_id)}</span><TeamBadge team={tb} className="size-5" /></span>
                      {(m.date || m.pitch || m.goals.length > 0) && (
                        <span className="col-span-3 text-center text-[10px] text-slate-400">
                          {m.date ? `${fmtDate(m.date, "EEE d MMM")}${m.time ? ` · ${m.time}` : ""}` : ""}{m.pitch ? ` · ${m.pitch}` : ""}
                          {m.goals.length > 0 ? ` · ⚽ ${m.goals.map((g) => `${g.player}${g.goals > 1 ? ` ×${g.goals}` : ""}`).join(", ")}` : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </section>
        );
      })}
      {hasKnockout && (
        <section className="space-y-3">
          <h3 className="font-heading text-lg font-bold">{t.format === "knockout" ? "Bracket" : "Knockout stage"}</h3>
          {t.format !== "knockout" && !t.matches.some((m) => m.stage === "knockout") ? (
            <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-400">
              {t.format === "groups_knockout"
                ? `Top ${t.advance_per_group} of each group advance — the bracket is drawn when the group stage ends.`
                : `Top ${t.playoff_teams} in the table make the playoffs — the bracket is drawn when the league ends.`}
            </div>
          ) : (
            <Bracket t={t} canManage={canManage} />
          )}
        </section>
      )}

      <MatchDialog t={t} match={selected} onClose={() => setSel(null)} canManage={canManage} />
    </div>
  );
}
