import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BellRing, CalendarClock, Star, X } from "lucide-react";
import MotmDialog from "@/components/MotmDialog";
import { apiGet, apiPost } from "@/lib/api";
import { fmtDate, money, refreshAll, useMe } from "@/lib/auth";
import type { GameNotice, MotmPending, Reminder } from "@/lib/types";

// In-app fee reminders: shown at the top of every screen until the player pays or dismisses.
export default function ReminderBanner() {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["reminders"], queryFn: () => apiGet<Reminder[]>("/reminders/mine"), enabled: !!me, refetchInterval: 60_000 });
  const dismiss = useMutation({ mutationFn: (id: string) => apiPost(`/reminders/${id}/dismiss`), onSuccess: () => refreshAll() });
  const list = q.isError ? [] : q.data ?? [];
  const soon = useQuery({ queryKey: ["games", "soon"], queryFn: () => apiGet<GameNotice[]>("/games/mine/soon"), enabled: !!me, refetchInterval: 300_000 });
  const pending = useQuery({ queryKey: ["motm", "pending"], queryFn: () => apiGet<MotmPending[]>("/motm/pending"), enabled: !!me, refetchInterval: 120_000 });
  const votes = pending.isError ? [] : pending.data ?? [];
  const [voting, setVoting] = useState<MotmPending | null>(null);
  const [hidden, setHidden] = useState<string[]>(() => JSON.parse(localStorage.getItem("hiddenGameNotices") ?? "[]") as string[]);
  const hide = (key: string) => {
    const next = [...hidden, key].slice(-50);
    setHidden(next);
    localStorage.setItem("hiddenGameNotices", JSON.stringify(next));
  };
  const notices = (soon.isError ? [] : soon.data ?? []).filter((n) => !hidden.includes(n.game.id + n.when));

  return (
    <div className="sticky top-0 z-40 space-y-2 px-3 pt-2 empty:hidden" data-testid="reminder-banner-stack">
      <MotmDialog gameId={voting?.game_id ?? null} title={voting ? `${voting.community_name} · ${fmtDate(voting.date, "EEE d MMM")}` : undefined} onClose={() => setVoting(null)} />
      <AnimatePresence>
        {votes.map((v) => (
          <motion.button
            key={`vote-${v.game_id}`}
            type="button"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            data-testid={`motm-banner-${v.game_id}`}
            onClick={() => setVoting(v)}
            className="flex w-full items-start gap-3 rounded-2xl border border-energy/40 bg-emerald-50/95 p-3 text-left shadow-lg shadow-black/10 backdrop-blur-xl dark:bg-[#0A1F18]/95"
          >
            <Star className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-semibold text-white">Vote for man of the match</span>
              <span className="block text-xs text-slate-300">{v.community_name} · {fmtDate(v.date, "EEE d MMM")} — tap to vote</span>
            </span>
          </motion.button>
        ))}
        {notices.map((n) => (
          <motion.div
            key={n.game.id + n.when}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            data-testid={`game-notice-${n.game.id}`}
            className="flex items-start gap-3 rounded-2xl border border-ice/40 bg-sky-50/95 dark:bg-[#0B1A24]/95 p-3 shadow-lg shadow-black/10 dark:shadow-black/40 backdrop-blur-xl"
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
            className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50/95 dark:bg-[#1F1A0A]/95 p-3 shadow-lg shadow-black/10 backdrop-blur-xl"
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
