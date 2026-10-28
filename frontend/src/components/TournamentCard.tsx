import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Tournament } from "@/lib/types";
import { fmtDate, money, sportImage } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: Tournament["status"] }) {
  const map = {
    registration: { label: "Open", cls: "bg-ice/15 text-ice border-ice/30" },
    ongoing: { label: "Live", cls: "bg-energy/15 text-energy border-energy/40" },
    completed: { label: "Finished", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  }[status];
  return (
    <span data-testid="tournament-status-badge" className={cn("inline-flex items-center gap-1.5 rounded-full border bg-page/80 backdrop-blur px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]", map.cls)}>
      {status === "ongoing" && <span className="size-1.5 animate-live rounded-full bg-energy" />}
      {map.label}
    </span>
  );
}

export default function TournamentCard({ t, wide = false }: { t: Tournament; wide?: boolean }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} className={cn(wide ? "w-72 shrink-0" : "w-full")}>
      <Link
        to={`/tournaments/${t.id}`}
        data-testid={`tournament-card-${t.id}`}
        className="group block overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color] duration-200 hover:border-energy/50"
      >
        <div className="relative h-32 overflow-hidden">
          <img src={sportImage(t.sport, t.image)} alt={t.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-page/20 via-page/50 to-surface" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <StatusBadge status={t.status} />
            {t.kind === "official" && (
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white">Official</span>
            )}
          </div>
          <div className="absolute bottom-2 right-3 text-right">
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-300">Prize</div>
            <div className="font-heading text-lg font-bold text-white">{money(t.prize_pool, t.currency)}</div>
          </div>
        </div>
        <div className="space-y-2 p-4 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ice">{t.sport}{t.community_name ? ` · ${t.community_name}` : ""}</div>
          <h3 className="font-heading text-lg font-bold leading-tight text-white">{t.title}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDate(t.start_date)}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{t.teams.length}/{t.max_teams} teams</span>
            {t.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{t.city}</span>}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-energy" style={{ width: `${Math.min(100, (t.teams.length / t.max_teams) * 100)}%` }} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
