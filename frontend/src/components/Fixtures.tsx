import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Bracket from "@/components/Bracket";
import { apiPost } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import type { Match, Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Fixtures tab: league / group matchdays (draws allowed) followed by the knockout bracket. */
export default function Fixtures({ t, canManage }: { t: Tournament; canManage: boolean }) {
  const [sel, setSel] = useState<Match | null>(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const name = (id: string | null) => (id ? t.teams.find((x) => x.id === id)?.name ?? "—" : "TBD");
  const table = t.matches.filter((m) => m.stage !== "knockout");
  const hasKnockout = t.format !== "league" && t.format !== "other";
  const groups = Array.from(new Set(table.map((m) => m.group ?? ""))).sort();

  const report = useMutation({
    mutationFn: () => apiPost<Tournament>(`/tournaments/${t.id}/matches/${sel?.id}/result`, { score_a: Number(a), score_b: Number(b) }),
    onSuccess: (res) => {
      const ko = res.matches.some((m) => m.stage === "knockout") && !t.matches.some((m) => m.stage === "knockout");
      toast.success(res.status === "completed" ? "Final table locked — champion crowned!" : ko ? "Stage complete — knockout bracket drawn!" : "Result saved");
      setSel(null);
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

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
                  return (
                    <button
                      type="button"
                      key={m.id}
                      disabled={!can}
                      data-testid={`fixture-${m.id}`}
                      onClick={() => { setSel(m); setA(""); setB(""); }}
                      className={cn(
                        "grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm transition-[border-color] duration-150",
                        can ? "border-energy/50 hover:border-energy" : "border-line",
                      )}
                    >
                      <span className={cn("truncate text-left", played && (m.score_a ?? 0) > (m.score_b ?? 0) && "font-bold text-white")}>{name(m.team_a_id)}</span>
                      <span className="min-w-14 rounded-md bg-elevated px-2 py-0.5 text-center font-heading font-bold">
                        {played ? `${m.score_a} – ${m.score_b}` : can ? "Score" : "vs"}
                      </span>
                      <span className={cn("truncate text-right", played && (m.score_b ?? 0) > (m.score_a ?? 0) && "font-bold text-white")}>{name(m.team_b_id)}</span>
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

      <Dialog open={!!sel} onOpenChange={(o: boolean) => !o && setSel(null)}>
        <DialogContent data-testid="fixture-result-dialog" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter score</DialogTitle>
          </DialogHeader>
          {sel && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{name(sel.team_a_id)}</Label>
                <Input data-testid="fixture-score-a-input" type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{name(sel.team_b_id)}</Label>
                <Input data-testid="fixture-score-b-input" type="number" min={0} value={b} onChange={(e) => setB(e.target.value)} />
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">Draws are allowed in league and group matches.</p>
          <DialogFooter>
            <Button data-testid="fixture-result-submit" disabled={a === "" || b === "" || report.isPending} onClick={() => report.mutate()}>Save score</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
