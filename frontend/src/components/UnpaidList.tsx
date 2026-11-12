import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { RemindResult, UnpaidGame } from "@/lib/types";

/** One list of every player still unpaid across all of a community's games, with one-tap reminders. */
export default function UnpaidList({ communityId, open }: { communityId: string; open: boolean }) {
  const q = useQuery({ queryKey: ["unpaid", communityId], queryFn: () => apiGet<UnpaidGame[]>(`/communities/${communityId}/unpaid`), enabled: open });
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });
  const games = q.data ?? [];
  const count = games.reduce((n, g) => n + g.players.length, 0);
  const due = games.reduce((n, g) => n + g.players.length * g.fee, 0);
  const sent = (r: RemindResult) =>
    toast.success(`Reminder sent to ${r.reminded} player${r.reminded === 1 ? "" : "s"}` + (r.skipped_guests ? ` · ${r.skipped_guests} guest name${r.skipped_guests === 1 ? "" : "s"} skipped` : ""));

  return (
    <section data-testid="unpaid-list" className="space-y-3 rounded-2xl border border-energy/30 bg-gradient-to-br from-ice/5 to-energy/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-heading text-base font-bold">All unpaid players</div>
          <div data-testid="unpaid-total" className="text-xs text-slate-400">
            {q.isLoading ? "Loading…" : count ? `${count} unpaid · OMR ${due} due across ${games.length} game${games.length === 1 ? "" : "s"}` : "Everyone has paid 🎉"}
          </div>
        </div>
        {count > 0 && (
          <Button size="sm" data-testid="unpaid-remind-all" className="shrink-0 bg-brand text-white" disabled={act.isPending}
            onClick={() => act.mutate(() => apiPost<RemindResult>(`/communities/${communityId}/remind-all-unpaid`), { onSuccess: (r) => sent(r as RemindResult) })}>
            <BellRing className="size-4" /> Remind all
          </Button>
        )}
      </div>
      {games.map((g) => (
        <div key={g.game_id} data-testid={`unpaid-game-${g.game_id}`} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ice">{fmtDate(g.date, "EEE d MMM")} · {g.time}</span>
            <span className="text-slate-400">OMR {g.fee} each</span>
          </div>
          {g.players.map((p) => (
            <div key={p.entry_id} data-testid={`unpaid-player-${p.entry_id}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {p.name}
                {!p.user_id && <span className="ml-1.5 text-[10px] text-slate-500">guest</span>}
                {p.reminded && <span data-testid={`unpaid-reminded-${p.entry_id}`} className="ml-1.5 text-[10px] text-amber-300">reminded</span>}
              </span>
              <span className="flex shrink-0 gap-1">
                {p.user_id && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remind ${p.name}`} data-testid={`unpaid-remind-${p.entry_id}`} disabled={act.isPending}
                    onClick={() => act.mutate(() => apiPost<RemindResult>(`/games/${g.game_id}/roster/${p.entry_id}/remind`), { onSuccess: () => toast.success(`Reminder sent to ${p.name}`) })}>
                    <BellRing className="size-4 text-ice" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8" data-testid={`unpaid-mark-paid-${p.entry_id}`} disabled={act.isPending}
                  onClick={() => act.mutate(() => apiPost(`/games/${g.game_id}/roster/${p.entry_id}/paid`, { paid: true }), { onSuccess: () => toast.success(`${p.name} marked paid`) })}>
                  <Check className="size-3.5" /> Paid
                </Button>
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
