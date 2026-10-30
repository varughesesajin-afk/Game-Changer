import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Goal, Medal, Star, Trophy } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PlayerProfile } from "@/lib/types";

/** Profile header stats: matches played, wins, goals and man-of-the-match awards. */
export default function MyStats({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ["player", userId, null], queryFn: () => apiGet<PlayerProfile>(`/players/${userId}`) });
  const p = q.isError ? undefined : q.data;
  const stats = [
    { icon: Medal, label: "Matches", value: p?.totals.games ?? 0 },
    { icon: Trophy, label: "Wins", value: p?.totals.wins ?? 0 },
    { icon: Goal, label: "Goals", value: p?.totals.goals ?? 0 },
    { icon: Star, label: "MOTM", value: p?.totals.motm ?? 0 },
  ];
  return (
    <section className="space-y-2" data-testid="profile-stats">
      <div className="grid grid-cols-4 gap-2">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} data-testid={`profile-stat-${label.toLowerCase()}`} className="rounded-xl border border-line bg-surface p-2.5 text-center">
            <Icon className={label === "MOTM" ? "mx-auto size-4 text-amber-400" : "mx-auto size-4 text-ice"} />
            <div className="mt-1 font-heading text-2xl font-bold">{value}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
          </div>
        ))}
      </div>
      {p && p.totals.games > 0 && (
        <Link to={`/players/${userId}`} data-testid="profile-matches-link" className="block text-right text-xs font-semibold text-ice hover:underline">
          See all matches played →
        </Link>
      )}
    </section>
  );
}
