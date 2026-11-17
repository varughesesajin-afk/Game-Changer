import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/Avatar";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import type { MotmState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (mins >= 120) return `${Math.round(mins / 60)} h`;
  if (mins >= 60) return "1 h";
  return `${Math.max(mins, 1)} min`;
}

/** Players on a played game vote for the man of the match for 24 hours; everyone can see the winner afterwards. */
export default function MotmVote({ gameId }: { gameId: string }) {
  const q = useQuery({ queryKey: ["motm", gameId], queryFn: () => apiGet<MotmState>(`/games/${gameId}/motm`), refetchInterval: 60_000 });
  const [pick, setPick] = useState<string | null>(null);
  const vote = useMutation({
    mutationFn: (entry_id: string) => apiPost<MotmState>(`/games/${gameId}/motm/vote`, { entry_id }),
    onSuccess: () => { toast.success("Vote saved"); setPick(null); refreshAll(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const s = q.isError ? undefined : q.data;
  if (!s || s.status === "none" || s.candidates.length < 2) return null;

  const open = s.status === "open";
  const showVotes = s.candidates.some((c) => c.votes !== null);
  const max = Math.max(1, ...s.candidates.map((c) => c.votes ?? 0));
  const chosen = pick ?? s.my_vote;
  const winner = s.candidates.find((c) => c.entry_id === s.winner_entry_id);

  return (
    <section data-testid={`motm-${gameId}`} className="space-y-2 rounded-2xl border-2 border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 font-heading text-base font-bold"><Star className="size-4 text-amber-400" /> Man of the match</h3>
          <p className="text-xs text-slate-400">
            {open
              ? s.can_vote ? "One vote each. You can't vote for yourself." : "Only players on this game can vote."
              : s.by_vote ? `Decided by ${s.voters} vote${s.voters === 1 ? "" : "s"}.` : "Picked by the host."}
          </p>
        </div>
        {open && <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-[11px] font-semibold text-slate-300">Closes in {timeLeft(s.closes_at)}</span>}
      </div>

      {!open && winner && (
        <div data-testid="motm-winner" className="flex items-center gap-2.5 rounded-xl border border-amber-400/50 bg-amber-100/70 p-2.5 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          <Star className="size-5 shrink-0 fill-amber-400 text-amber-500" />
          <div className="text-sm font-semibold">{winner.name}{winner.votes ? <span className="font-normal"> · {winner.votes} vote{winner.votes === 1 ? "" : "s"}</span> : null}</div>
        </div>
      )}

      <ul className="space-y-1.5">
        {s.candidates.map((c) => {
          const selected = open && chosen === c.entry_id;
          const disabled = !open || !s.can_vote || c.is_me;
          return (
            <li key={c.entry_id}>
              <button
                type="button"
                disabled={disabled}
                data-testid={`motm-pick-${c.entry_id}`}
                onClick={() => setPick(c.entry_id)}
                className={cn(
                  "relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border-2 px-2.5 py-2 text-left text-sm transition-colors",
                  selected ? "border-energy ring-2 ring-energy/20" : "border-line",
                  !disabled && !selected && "hover:border-slate-500",
                  disabled && "cursor-default",
                )}
              >
                {showVotes && <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-ice/15 to-energy/20" style={{ width: `${((c.votes ?? 0) / max) * 100}%` }} />}
                <Avatar name={c.name} picture={c.picture} className="relative size-8" />
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.name}{c.is_me ? " (you)" : ""}</span>
                  <span className="block text-[11px] text-slate-400">{c.goals > 0 ? `${c.goals} goal${c.goals === 1 ? "" : "s"}` : `Team ${c.team}`}{s.my_vote === c.entry_id ? " · your vote" : ""}</span>
                </span>
                {showVotes && <span className="relative font-heading text-sm font-bold">{c.votes ?? 0}</span>}
                {selected && <span className="relative grid size-5 place-items-center rounded-full bg-energy text-white"><Check className="size-3" /></span>}
              </button>
            </li>
          );
        })}
      </ul>

      {open && s.can_vote && (
        <>
          <Button data-testid="motm-submit" className="w-full bg-brand text-white" disabled={!pick || pick === s.my_vote || vote.isPending} onClick={() => pick && vote.mutate(pick)}>
            {vote.isPending ? "Saving…" : s.my_vote ? "Change my vote" : "Submit vote"}
          </Button>
          <p className="text-center text-[11px] text-slate-400">{s.voters} of {s.eligible} players voted</p>
        </>
      )}
    </section>
  );
}
