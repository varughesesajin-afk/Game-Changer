import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { fmtDate, money, refreshAll, useMe } from "@/lib/auth";
import type { Reminder } from "@/lib/types";

// In-app fee reminders: shown at the top of every screen until the player pays or dismisses.
export default function ReminderBanner() {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["reminders"], queryFn: () => apiGet<Reminder[]>("/reminders/mine"), enabled: !!me, refetchInterval: 60_000 });
  const dismiss = useMutation({ mutationFn: (id: string) => apiPost(`/reminders/${id}/dismiss`), onSuccess: () => refreshAll() });
  const list = q.isError ? [] : q.data ?? [];

  return (
    <div className="sticky top-0 z-40 space-y-2 px-3 pt-2 empty:hidden" data-testid="reminder-banner-stack">
      <AnimatePresence>
        {list.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            data-testid={`fee-reminder-${r.id}`}
            className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-[#1F2A1A]/90 p-3 shadow-lg shadow-black/40 backdrop-blur-xl"
          >
            <BellRing className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <Link to={`/communities/${r.community_id}`} className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-white">
                You owe {money(r.amount, r.currency)} for {r.community_name}
              </div>
              <div className="text-xs text-slate-300">
                Game on {fmtDate(r.game_date, "EEE d MMM")}{r.game_time ? ` · ${r.game_time}` : ""} — reminder from {r.sent_by || "the organiser"}
              </div>
            </Link>
            <button
              type="button"
              aria-label="Dismiss reminder"
              data-testid={`fee-reminder-dismiss-${r.id}`}
              onClick={() => dismiss.mutate(r.id)}
              className="text-slate-400 transition-colors hover:text-white"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
