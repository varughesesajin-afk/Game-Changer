import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MatchSheet, { eventsFromTotals, pk, splitKey, type SheetSide, type SheetValue } from "@/components/MatchSheet";
import { apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { Game, GameSheetIn, TeamSide } from "@/lib/types";

export function gameSides(game: Game): [SheetSide, SheetSide] {
  const side = (t: TeamSide): SheetSide => ({ key: t, name: `Team ${t}`, players: game.roster.filter((r) => r.team === t).map((r) => ({ id: r.id, name: r.name })) });
  return [side("A"), side("B")];
}

export function gameSheetValue(game: Game): SheetValue {
  const r = game.result;
  const team = (id: string) => game.roster.find((x) => x.id === id)?.team ?? "A";
  const events = r?.events.length
    ? r.events.map((e) => ({ team: e.team, scorer: e.scorer_id, assist: e.assist_id }))
    : (["A", "B"] as const).flatMap((t) => eventsFromTotals(t, game.roster.filter((x) => x.team === t), t === "A" ? r?.score_a ?? 0 : r?.score_b ?? 0));
  return {
    events,
    late: game.roster.filter((x) => x.late).map((x) => pk(x.team, x.id)),
    paid: game.roster.filter((x) => x.paid).map((x) => pk(x.team, x.id)),
    motm: r?.motm_entry_id ? pk(team(r.motm_entry_id), r.motm_entry_id) : null,
  };
}

/** Community game match sheet dialog — editable for the host, read-only for everyone else. */
export function GameSheetDialog({ game, canManage, onClose }: { game: Game | null; canManage: boolean; onClose: () => void }) {
  const save = useMutation({
    mutationFn: ({ g, v }: { g: Game; v: SheetValue }) => {
      const body: GameSheetIn = {
        events: v.events.map((e) => ({ team: e.team as TeamSide, scorer_id: e.scorer, assist_id: e.assist })),
        late_ids: v.late.map((k) => splitKey(k)[1]),
        paid_ids: v.paid.map((k) => splitKey(k)[1]),
        motm_entry_id: v.motm ? splitKey(v.motm)[1] : null,
      };
      return apiPost<Game>(`/games/${g.id}/sheet`, body);
    },
    onSuccess: () => {
      toast.success("Match sheet saved — leaderboard updated");
      refreshAll();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!game} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent data-testid="game-sheet-dialog" className="max-h-[90dvh] max-w-md overflow-x-hidden overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="font-heading">Match sheet</DialogTitle>
          {game && <p className="text-sm text-slate-400">{fmtDate(game.date, "EEE d MMM")} · {game.time}{game.venue ? ` · ${game.venue}` : ""}</p>}
        </DialogHeader>
        {game && (
          <>
            {!canManage && game.result && (
              <div className="text-center font-heading text-2xl font-bold">Team A {game.result.score_a ?? 0} – {game.result.score_b ?? 0} Team B</div>
            )}
            <MatchSheet key={game.id} sides={gameSides(game)} initial={gameSheetValue(game)} canManage={canManage} saving={save.isPending} onSave={(v) => save.mutate({ g: game, v })} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Row in the host's Results tab: opens the match sheet. */
export default function GameResultForm({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const r = game.result;
  return (
    <div data-testid={`result-form-${game.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="min-w-0">
        <div className="font-heading font-bold">{fmtDate(game.date, "EEE d MMM")}</div>
        <div className="text-xs text-slate-400">{r ? `Team A ${r.score_a ?? 0} – ${r.score_b ?? 0} Team B` : `${game.roster.length} players · no result yet`}</div>
      </div>
      <Button size="sm" data-testid={`result-open-sheet-${game.id}`} className={r ? "" : "bg-brand text-white"} variant={r ? "outline" : "default"} onClick={() => setOpen(true)}>
        <ClipboardList className="size-4" /> Match sheet
      </Button>
      <GameSheetDialog game={open ? game : null} canManage onClose={() => setOpen(false)} />
    </div>
  );
}
