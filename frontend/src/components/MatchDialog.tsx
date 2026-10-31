import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, MapPin, Minus, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TeamBadge from "@/components/TeamBadge";
import { apiPatch, apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { Match, MatchScheduleIn, MatchStatsIn, Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Match centre: kick-off schedule, score, goal scorers and man of the match. Read-only for non-organisers. */
export default function MatchDialog({ t, match, onClose, canManage }: { t: Tournament; match: Match | null; onClose: () => void; canManage: boolean }) {
  return (
    <Dialog open={!!match} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent data-testid="match-dialog" className="max-h-[88dvh] max-w-sm overflow-x-hidden overflow-y-auto overscroll-contain">
        {match && <Body key={match.id} t={t} m={match} canManage={canManage} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ t, m, canManage, onClose }: { t: Tournament; m: Match; canManage: boolean; onClose: () => void }) {
  const teamA = t.teams.find((x) => x.id === m.team_a_id);
  const teamB = t.teams.find((x) => x.id === m.team_b_id);
  const played = m.score_a !== null && m.score_b !== null;
  const [sched, setSched] = useState<MatchScheduleIn>({ date: m.date, time: m.time, pitch: m.pitch });
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const key = (tid: string, p: string) => `${tid}::${p}`;
  const [goals, setGoals] = useState<Record<string, number>>(() => Object.fromEntries(m.goals.map((g) => [key(g.team_id, g.player), g.goals])));
  const [motm, setMotm] = useState<string | null>(m.motm_team_id && m.motm_player ? key(m.motm_team_id, m.motm_player) : null);

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  const saveStats = () => {
    const body: MatchStatsIn = {
      goals: Object.entries(goals).filter(([, n]) => n > 0).map(([k, n]) => {
        const [team_id, player] = k.split("::");
        return { team_id, player, goals: n };
      }),
      motm_team_id: motm ? motm.split("::")[0] : null,
      motm_player: motm ? motm.split("::")[1] : null,
    };
    act.mutate(() => apiPost(`/tournaments/${t.id}/matches/${m.id}/stats`, body), { onSuccess: () => toast.success("Scorers saved") });
  };

  const sides = [teamA, teamB].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading">Match centre</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="flex flex-col items-center gap-1"><TeamBadge team={teamA} className="size-10" /><span className="text-sm font-semibold">{teamA?.name ?? "TBD"}</span></div>
        <span data-testid="match-score" className="font-heading text-2xl font-bold">{played ? `${m.score_a} – ${m.score_b}` : "vs"}</span>
        <div className="flex flex-col items-center gap-1"><TeamBadge team={teamB} className="size-10" /><span className="text-sm font-semibold">{teamB?.name ?? "TBD"}</span></div>
      </div>
      <div data-testid="match-schedule-info" className="space-y-1 rounded-xl bg-elevated/60 p-3 text-sm text-slate-300">
        <div className="flex items-center gap-1.5"><CalendarClock className="size-4 text-ice" />{m.date ? `${fmtDate(m.date, "EEE d MMM")}${m.time ? ` · ${m.time}` : ""}` : "Kick-off not set yet"}</div>
        <div className="flex items-center gap-1.5"><MapPin className="size-4 text-ice" />{m.pitch || t.venue || "Pitch TBA"}</div>
      </div>

      {canManage && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Schedule</div>
          <div className="grid grid-cols-1 gap-2">
            <Input type="date" aria-label="Match date" data-testid="match-date-input" value={sched.date ?? ""} onChange={(e) => setSched({ ...sched, date: e.target.value })} />
            <Input type="time" aria-label="Kick-off time" data-testid="match-time-input" value={sched.time ?? ""} onChange={(e) => setSched({ ...sched, time: e.target.value })} />
          </div>
          <Input aria-label="Pitch" placeholder="Pitch / court" data-testid="match-pitch-input" value={sched.pitch ?? ""} onChange={(e) => setSched({ ...sched, pitch: e.target.value })} />
          <Button size="sm" variant="outline" className="w-full" data-testid="match-schedule-save" disabled={act.isPending}
            onClick={() => act.mutate(() => apiPatch(`/tournaments/${t.id}/matches/${m.id}/schedule`, sched), { onSuccess: () => toast.success("Fixture scheduled") })}>
            Save schedule
          </Button>
        </div>
      )}

      {canManage && !played && teamA && teamB && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Final score</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">{teamA.name}</Label><Input type="number" min={0} data-testid="match-score-a-input" value={a} onChange={(e) => setA(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{teamB.name}</Label><Input type="number" min={0} data-testid="match-score-b-input" value={b} onChange={(e) => setB(e.target.value)} /></div>
          </div>
          {m.stage === "knockout" && <p className="text-xs text-slate-500">Knockout matches need a winner — no draws.</p>}
          <Button size="sm" className="w-full" data-testid="match-score-save" disabled={a === "" || b === "" || act.isPending}
            onClick={() => act.mutate(() => apiPost<Tournament>(`/tournaments/${t.id}/matches/${m.id}/result`, { score_a: Number(a), score_b: Number(b) }), { onSuccess: () => { toast.success("Score saved"); onClose(); } })}>
            Save score
          </Button>
        </div>
      )}

      {sides.length === 2 && (canManage || m.goals.length > 0 || m.motm_player) && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Scorers{canManage ? " · tap the star for man of the match" : ""}</div>
          {sides.map((team) => (
            <div key={team.id} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ice"><TeamBadge team={team} className="size-4" />{team.name}</div>
              {team.players
                .filter((p) => canManage || (goals[key(team.id, p)] ?? 0) > 0 || motm === key(team.id, p))
                .map((p) => {
                  const k = key(team.id, p);
                  return (
                    <div key={k} className="flex items-center justify-between rounded-lg bg-elevated/60 px-3 py-1 text-sm">
                      <span className="truncate">{p}</span>
                      <span className="flex items-center gap-1.5">
                        {(canManage || motm === k) && (
                          <button type="button" disabled={!canManage} aria-label={`Man of the match ${p}`} data-testid={`match-motm-${team.id}-${p}`}
                            onClick={() => setMotm(motm === k ? null : k)} className={cn("p-1", motm === k ? "text-amber-400" : "text-slate-600 hover:text-amber-300")}>
                            <Star className="size-4" fill={motm === k ? "currentColor" : "none"} />
                          </button>
                        )}
                        {canManage && (
                          <button type="button" aria-label={`Less for ${p}`} onClick={() => setGoals({ ...goals, [k]: Math.max(0, (goals[k] ?? 0) - 1) })} className="rounded p-1 text-slate-400 hover:bg-line"><Minus className="size-3.5" /></button>
                        )}
                        <span data-testid={`match-goals-${team.id}-${p}`} className="w-5 text-center font-heading font-bold">{goals[k] ?? 0}</span>
                        {canManage && (
                          <button type="button" aria-label={`More for ${p}`} data-testid={`match-goal-plus-${team.id}-${p}`} onClick={() => setGoals({ ...goals, [k]: (goals[k] ?? 0) + 1 })} className="rounded p-1 text-slate-400 hover:bg-line"><Plus className="size-3.5" /></button>
                        )}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
          {canManage && (
            <Button size="sm" className="w-full bg-brand text-white" data-testid="match-stats-save" disabled={act.isPending} onClick={saveStats}>
              Save scorers
            </Button>
          )}
        </div>
      )}
    </>
  );
}
