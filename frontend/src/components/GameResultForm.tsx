import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { Game, GameResult, GameResultIn } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function GameResultForm({ game }: { game: Game }) {
  const [winner, setWinner] = useState<GameResult["winner"]>(game.result?.winner ?? "A");
  const [sa, setSa] = useState(game.result?.score_a?.toString() ?? "");
  const [sb, setSb] = useState(game.result?.score_b?.toString() ?? "");
  const [goals, setGoals] = useState<Record<string, number>>(() => Object.fromEntries(game.roster.map((r) => [r.id, r.goals])));

  const save = useMutation({
    mutationFn: () => {
      const body: GameResultIn = { winner, score_a: sa === "" ? null : Number(sa), score_b: sb === "" ? null : Number(sb), goals };
      return apiPost<Game>(`/games/${game.id}/result`, body);
    },
    onSuccess: () => {
      toast.success("Result saved — leaderboard updated");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const bump = (id: string, d: number) => setGoals((g) => ({ ...g, [id]: Math.max(0, (g[id] ?? 0) + d) }));

  return (
    <div data-testid={`result-form-${game.id}`} className="space-y-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="font-heading font-bold">{fmtDate(game.date, "EEE d MMM")}</span>
        {game.result && <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Recorded</span>}
      </div>
      <div className="flex gap-1.5">
        {(["A", "draw", "B"] as const).map((w) => (
          <button
            key={w}
            type="button"
            data-testid={`result-winner-${w}-${game.id}`}
            onClick={() => setWinner(w)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-[background-color,color] duration-150",
              winner === w ? "border-transparent bg-brand text-white" : "border-line text-slate-300",
            )}
          >
            {w === "draw" ? "Draw" : `Team ${w} won`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Score</span>
        <Input data-testid={`result-score-a-${game.id}`} type="number" min={0} placeholder="A" value={sa} onChange={(e) => setSa(e.target.value)} className="h-8 w-16" />
        <span className="text-slate-500">–</span>
        <Input data-testid={`result-score-b-${game.id}`} type="number" min={0} placeholder="B" value={sb} onChange={(e) => setSb(e.target.value)} className="h-8 w-16" />
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Goals / points</div>
        {game.roster.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-elevated/60 px-3 py-1 text-sm">
            <span className="truncate">
              <span className={cn("mr-1.5 text-[10px] font-bold", r.team === "A" ? "text-energy" : "text-ice")}>{r.team}</span>
              {r.name}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label={`Less for ${r.name}`} data-testid={`goals-minus-${r.id}`} onClick={() => bump(r.id, -1)} className="rounded-md p-1 text-slate-400 hover:bg-line">
                <Minus className="size-3.5" />
              </button>
              <span data-testid={`goals-value-${r.id}`} className="w-5 text-center font-heading font-bold">{goals[r.id] ?? 0}</span>
              <button type="button" aria-label={`More for ${r.name}`} data-testid={`goals-plus-${r.id}`} onClick={() => bump(r.id, 1)} className="rounded-md p-1 text-slate-400 hover:bg-line">
                <Plus className="size-3.5" />
              </button>
            </span>
          </div>
        ))}
        {game.roster.length === 0 && <p className="text-xs text-slate-500">No players were on this game.</p>}
      </div>
      <Button size="sm" className="w-full" data-testid={`result-save-${game.id}`} disabled={save.isPending} onClick={() => save.mutate()}>
        {game.result ? "Update result" : "Save result"}
      </Button>
    </div>
  );
}
