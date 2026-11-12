import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarClock, MapPin, Users } from "lucide-react";
import type { Community } from "@/lib/types";
import { money, sportImage } from "@/lib/auth";

export default function CommunityCard({ c, badge }: { c: Community; badge?: string }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link
        to={`/communities/${c.id}`}
        data-testid={`community-card-${c.id}`}
        className="flex gap-3 rounded-2xl border border-line bg-surface p-3 transition-[border-color] duration-200 hover:border-ice/50"
      >
        <img src={sportImage(c.sport, c.image)} alt={c.name} className="size-20 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ice">{c.sport}</div>
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-base font-bold text-white">{c.name}</h3>
            {c.approval_status !== "approved" && (
              <span data-testid={`community-approval-badge-${c.id}`} className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
                {c.approval_status === "pending" ? "Pending" : "Declined"}
              </span>
            )}
            {badge && (
              <span data-testid={`community-badge-${c.id}`} className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                {badge}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{c.days.join(" & ") || "Ad-hoc"} · {c.time}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{c.members.length}</span>
            {c.venue && <span className="inline-flex items-center gap-1 truncate"><MapPin className="size-3.5" />{c.venue}</span>}
          </div>
          <div className="text-xs font-semibold text-energy">{money(c.fee)} / game</div>
        </div>
      </Link>
    </motion.div>
  );
}
