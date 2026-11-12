import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { GameSheetDialog } from "@/components/GameResultForm";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/auth";
import type { Game } from "@/lib/types";

/** Recent played games with a result — anyone can open the read-only match sheet; the host can edit it. */
export default function RecentResults({ communityId, canManage }: { communityId: string; canManage: boolean }) {
  const q = useQuery({ queryKey: ["games", communityId, "past"], queryFn: () => apiGet<Game[]>(`/communities/${communityId}/games?past=true`) });
  const [open, setOpen] = useState<string | null>(null);
  const games = (q.data ?? []).filter((g) => g.result).slice(0, 5);
  if (!games.length) return null;
  const sel = games.find((g) => g.id === open) ?? null;
  return (
    <section data-testid="recent-results" className="space-y-2">
      <h2 className="font-heading text-lg font-bold">Recent results</h2>
      {games.map((g) => {
        const r = g.result!;
        const scorers = g.roster.filter((x) => x.goals > 0).map((x) => `${x.name}${x.goals > 1 ? ` ×${x.goals}` : ""}`);
        const late = g.roster.filter((x) => x.late).map((x) => x.name);
        return (
          <button key={g.id} type="button" data-testid={`recent-result-${g.id}`} onClick={() => setOpen(g.id)}
            className="w-full space-y-1 rounded-2xl border border-line bg-surface p-3 text-left text-sm transition-[border-color] duration-150 hover:border-ice">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{fmtDate(g.date, "EEE d MMM")}</span>
              <span className="font-heading font-bold">A {r.score_a ?? 0} – {r.score_b ?? 0} B</span>
            </div>
            {scorers.length > 0 && <div className="text-xs text-slate-300">⚽ {scorers.join(", ")}</div>}
            {late.length > 0 && <div className="text-xs text-amber-300">⏰ Late: {late.join(", ")}</div>}
            <div className="flex items-center gap-1 text-xs text-ice"><ClipboardList className="size-3.5" /> Match sheet</div>
          </button>
        );
      })}
      <GameSheetDialog game={sel} canManage={canManage} onClose={() => setOpen(null)} />
    </section>
  );
}
