import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Avatar from "@/components/Avatar";
import { apiPut } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import type { Game, TeamSide } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Host/admin splits the players of a numbered-spots game into Team A and Team B (needed for the score sheet). */
export default function TeamSplitDialog({ game, open, onClose }: { game: Game; open: boolean; onClose: () => void }) {
  const ordered = [...game.roster].sort((a, b) => (a.spot ?? 999) - (b.spot ?? 999));
  const [teams, setTeams] = useState<Record<string, TeamSide>>({});
  useEffect(() => {
    if (open) setTeams(Object.fromEntries(game.roster.map((r) => [r.id, r.team])));
  }, [open, game.roster]);

  const save = useMutation({
    mutationFn: () => apiPut<Game>(`/games/${game.id}/teams`, { teams }),
    onSuccess: () => { toast.success("Teams saved"); refreshAll(); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const split = () => setTeams(Object.fromEntries(ordered.map((r, i) => [r.id, (i % 2 === 0 ? "A" : "B") as TeamSide])));
  const count = (t: TeamSide) => Object.values(teams).filter((x) => x === t).length;

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent data-testid="team-split-dialog" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Set teams</DialogTitle>
          <DialogDescription>Team A {count("A")} · Team B {count("B")}. The match sheet uses these teams for the score.</DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" size="sm" data-testid="team-split-even" onClick={split}><Shuffle className="size-4" /> Split evenly by number</Button>
        <ul className="space-y-1.5">
          {ordered.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-bold text-slate-400">{r.spot ?? "-"}</span>
              <Avatar name={r.name} picture={r.picture} className="size-7" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
              <div className="flex gap-1">
                {(["A", "B"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    data-testid={`team-split-${r.id}-${t}`}
                    onClick={() => setTeams((p) => ({ ...p, [r.id]: t }))}
                    className={cn("h-7 w-9 rounded-lg border-2 text-xs font-bold transition-colors", teams[r.id] === t ? (t === "A" ? "border-energy bg-energy/15 text-energy" : "border-ice bg-ice/15 text-ice") : "border-line text-slate-400")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Button data-testid="team-split-save" className="w-full bg-brand text-white" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save teams"}</Button>
      </DialogContent>
    </Dialog>
  );
}
