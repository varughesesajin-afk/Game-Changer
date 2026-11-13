import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import TeamBadge from "@/components/TeamBadge";
import { JerseyChip, JerseyPicker } from "@/components/Jersey";
import MatchSheet, { eventsFromTotals, pk, splitKey, type SheetSide, type SheetValue } from "@/components/MatchSheet";
import { apiPatch, apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { Match, MatchScheduleIn, MatchSheetIn, Team, Tournament } from "@/lib/types";

const side = (team: Team): SheetSide => ({ key: team.id, name: team.name, badge: <TeamBadge team={team} className="size-6" />, players: team.players.map((p) => ({ id: p, name: p })) });

const group = (keys: string[]) =>
  keys.reduce<Record<string, string[]>>((acc, k) => {
    const [tid, p] = splitKey(k);
    (acc[tid] ??= []).push(p);
    return acc;
  }, {});

export function tournamentSheetValue(m: Match): SheetValue {
  const flat = (rec: Record<string, string[]>) => Object.entries(rec).flatMap(([tid, names]) => names.map((n) => pk(tid, n)));
  const events = m.events.length
    ? m.events.map((e) => ({ team: e.team_id, scorer: e.scorer, assist: e.assist }))
    : [m.team_a_id, m.team_b_id].flatMap((tid, i) => (tid ? eventsFromTotals(tid, m.goals.filter((g) => g.team_id === tid).map((g) => ({ id: g.player, goals: g.goals })), i === 0 ? m.score_a : m.score_b) : []));
  return { events, late: flat(m.late), paid: flat(m.paid), motm: m.motm_team_id && m.motm_player ? pk(m.motm_team_id, m.motm_player) : null };
}

/** Match centre: kick-off schedule plus the match sheet (goals + assists, late, paid, man of the match). Read-only for non-organisers. */
export default function MatchDialog({ t, match, onClose, canManage }: { t: Tournament; match: Match | null; onClose: () => void; canManage: boolean }) {
  return (
    <Dialog open={!!match} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent data-testid="match-dialog" className="max-h-[88dvh] sm:max-w-md lg:max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain">
        {match && <Body key={match.id} t={t} m={match} canManage={canManage} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ t, m, canManage, onClose }: { t: Tournament; m: Match; canManage: boolean; onClose: () => void }) {
  const teamA = t.teams.find((x) => x.id === m.team_a_id);
  const teamB = t.teams.find((x) => x.id === m.team_b_id);
  const played = m.score_a !== null && m.score_b !== null;
  const [sched, setSched] = useState<MatchScheduleIn>({ date: m.date, time: m.time, pitch: m.pitch, jersey_a: m.jersey_a, jersey_b: m.jersey_b });

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading">Match sheet</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="flex flex-col items-center gap-1"><TeamBadge team={teamA} className="size-10" /><span className="text-sm font-semibold">{teamA?.name ?? "TBD"}</span></div>
        <span data-testid="match-score" className="font-heading text-2xl font-bold">{played ? `${m.score_a} – ${m.score_b}` : "vs"}</span>
        <div className="flex flex-col items-center gap-1"><TeamBadge team={teamB} className="size-10" /><span className="text-sm font-semibold">{teamB?.name ?? "TBD"}</span></div>
      </div>
      <div data-testid="match-schedule-info" className="space-y-1 rounded-xl bg-elevated/60 p-3 text-sm text-slate-300">
        <div className="flex items-center gap-1.5"><CalendarClock className="size-4 text-ice" />{m.date ? `${fmtDate(m.date, "EEE d MMM")}${m.time ? ` · ${m.time}` : ""}` : "Kick-off not set yet"}</div>
        <div className="flex items-center gap-1.5"><MapPin className="size-4 text-ice" />{m.pitch || t.venue || "Pitch TBA"}</div>
        {(m.jersey_a || m.jersey_b) && (
          <div data-testid="match-jerseys" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {m.jersey_a && <span className="flex items-center gap-1 text-xs">{teamA?.name}: <JerseyChip jersey={m.jersey_a} /></span>}
            {m.jersey_b && <span className="flex items-center gap-1 text-xs">{teamB?.name}: <JerseyChip jersey={m.jersey_b} /></span>}
          </div>
        )}
      </div>

      {canManage && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Schedule</div>
          <div className="grid grid-cols-1 gap-2">
            <Input type="date" aria-label="Match date" data-testid="match-date-input" value={sched.date ?? ""} onChange={(e) => setSched({ ...sched, date: e.target.value })} />
            <Input type="time" aria-label="Kick-off time" data-testid="match-time-input" value={sched.time ?? ""} onChange={(e) => setSched({ ...sched, time: e.target.value })} />
          </div>
          <Input aria-label="Pitch" placeholder="Pitch / court" data-testid="match-pitch-input" value={sched.pitch ?? ""} onChange={(e) => setSched({ ...sched, pitch: e.target.value })} />
          <JerseyPicker labelA={teamA?.name ?? "Home"} labelB={teamB?.name ?? "Away"} a={sched.jersey_a} b={sched.jersey_b} testPrefix="match-jersey"
            onChange={(a, b) => setSched({ ...sched, jersey_a: a, jersey_b: b })} />
          <Button size="sm" variant="outline" className="w-full" data-testid="match-schedule-save" disabled={act.isPending}
            onClick={() => act.mutate(() => apiPatch(`/tournaments/${t.id}/matches/${m.id}/schedule`, sched), { onSuccess: () => toast.success("Fixture scheduled") })}>
            Save schedule
          </Button>
        </div>
      )}

      {teamA && teamB && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Match sheet</div>
          <MatchSheet
            key={m.id + (m.score_a ?? "")}
            sides={[side(teamA), side(teamB)]}
            initial={tournamentSheetValue(m)}
            canManage={canManage}
            saving={act.isPending}
            note={played ? `Score is recorded as ${m.score_a} – ${m.score_b} — goals must add up to it.` : m.stage === "knockout" ? "Knockout matches need a winner — no draws." : undefined}
            onSave={(v) => {
              const body: MatchSheetIn = {
                events: v.events.map((e) => ({ team_id: e.team, scorer: e.scorer, assist: e.assist })),
                late: group(v.late),
                paid: group(v.paid),
                motm_team_id: v.motm ? splitKey(v.motm)[0] : null,
                motm_player: v.motm ? splitKey(v.motm)[1] : null,
              };
              act.mutate(() => apiPost<Tournament>(`/tournaments/${t.id}/matches/${m.id}/sheet`, body), { onSuccess: () => { toast.success("Match sheet saved"); onClose(); } });
            }}
          />
        </div>
      )}
    </>
  );
}
