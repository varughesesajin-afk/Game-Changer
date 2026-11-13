import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarClock, MapPin, Users } from "lucide-react";
import type { Community } from "@/lib/types";
import { money, sportImage } from "@/lib/auth";

// Photo fills the top half of the card, the name sits on the photo, the details sit below.
export default function CommunityCard({ c, badge }: { c: Community; badge?: string }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link
        to={`/communities/${c.id}`}
        data-testid={`community-card-${c.id}`}
        className="group block overflow-hidden rounded-[1.75rem] border-2 border-line bg-surface transition-[border-color] duration-200 hover:border-ice/60"
      >
        <div className="on-dark relative h-40 overflow-hidden lg:h-44">
          <img src={sportImage(c.sport, c.image)} alt={c.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/75" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#ffffff]/95 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
              {c.visibility === "private" ? "Private" : "Open"}
            </span>
            {c.approval_status !== "approved" && (
              <span data-testid={`community-approval-badge-${c.id}`} className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                {c.approval_status === "pending" ? "Pending" : "Declined"}
              </span>
            )}
          </div>
          {badge && (
            <span data-testid={`community-badge-${c.id}`} className="bg-brand absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm">
              {badge}
            </span>
          )}
          <div className="absolute inset-x-4 bottom-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/80">{c.sport}</div>
            <h3 className="line-clamp-2 font-heading text-xl font-bold leading-tight text-white drop-shadow">{c.name}</h3>
          </div>
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate font-heading text-base font-bold text-white">Host · {c.owner_name}</div>
            <div className="shrink-0 text-sm font-bold text-energy">{money(c.fee)} / game</div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1"><Users className="size-4" />{c.members.length} members</span>
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-4" />{c.days.join(" & ") || "Ad-hoc"} · {c.time}</span>
            {c.venue && <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="size-4 shrink-0" /><span className="truncate">{c.venue}</span></span>}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
