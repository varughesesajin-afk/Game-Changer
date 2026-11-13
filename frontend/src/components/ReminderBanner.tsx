import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BellRing, CalendarClock, X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { fmtDate, money, refreshAll, useMe } from "@/lib/auth";
import type { GameNotice, Reminder } from "@/lib/types";

// In-app fee reminders: shown at the top of every screen until the player pays or dismisses.
export default function ReminderBanner() {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["reminders"], queryFn: () => apiGet<Reminder[]>("/reminders/mine"), enabled: !!me, refetchInterval: 60_000 });
  const dismiss = useMutation({ mutationFn: (id: string) => apiPost(`/reminders/${id}/dismiss`), onSuccess: () => refreshAll() });
  const list = q.isError ? [] : q.data ?? [];
  const soon = useQuery({ queryKey: ["games", "soon"], queryFn: () => apiGet<GameNotice[]>("/games/mine/soon"), enabled: !!me, refetchInterval: 300_000 });
  const [hidden, setHidden] = useState<string[]>(() => JSON.parse(localStorage.getItem("hiddenGameNotices") ?? "[]") as string[]);
  const hide = (key: string) => {
    const next = [...hidden, key].slice(-50);
    setHidden(next);
    localStorage.setItem("hiddenGameNotices", JSON.stringify(next));
  };
  const notices = (soon.isError ? [] : soon.data ?? []).filter((n) => !hidden.includes(n.game.id + n.when));

  return (
    <div className="sticky top-0 z-40 space-y-2 px-3 pt-2 empty:hidden" data-testid="reminder-banner-stack">
      <AnimatePresence>
        {notices.map((n) => (
          <motion.div
            key={n.game.id + n.when}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            data-testid={`game-notice-${n.game.id}`}
            className="flex items-start gap-3 rounded-2xl border border-ice/40 bg-sky-50/95 p-3 shadow-lg shadow-black/10 backdrop-blur-xl"
          >
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-ice" />
            <Link to={`/communities/${n.game.community_id}`} className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-white">
                Game on {n.when} · {n.game.time}
              </div>
              <div className="text-xs text-slate-300">
                {n.game.community_name}{n.game.venue ? ` at ${n.game.venue}` : ""} — you're on Team {n.game.roster.find((r) => r.user_id === me?.user_id)?.team ?? "A"}
              </div>
            </Link>
            <button type="button" aria-label="Dismiss notice" data-testid={`game-notice-dismiss-${n.game.id}`} onClick={() => hide(n.game.id + n.when)} className="text-slate-400 transition-colors hover:text-white">
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
        {list.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            data-testid={`fee-reminder-${r.id}`}
            className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50/95 p-3 shadow-lg shadow-black/10 backdrop-blur-xl"
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
