import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { JerseyChip, JerseyPicker } from "@/components/Jersey";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { Community, Game, GameCreate, GameUpdate } from "@/lib/types";

/** Manage → Games: schedule a game on any date, and move or cancel upcoming ones. */
export default function GameScheduler({ c, games }: { c: Community; games: Game[] }) {
  const blank: GameCreate = { date: "", time: c.time, venue: c.venue, jersey_a: null, jersey_b: null };
  const [f, setF] = useState<GameCreate>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<GameUpdate>({});

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  const schedule = () =>
    act.mutate(() => apiPost<Game>(`/communities/${c.id}/games`, f), {
      onSuccess: () => {
        toast.success(`Game scheduled for ${fmtDate(f.date, "EEE d MMM")}`);
        setF(blank);
      },
    });

  return (
    <div className="space-y-4">
      <div data-testid="schedule-game-form" className="space-y-3 rounded-2xl border border-energy/40 bg-gradient-to-br from-ice/10 to-energy/10 p-4">
        <div className="font-heading text-lg font-bold">Schedule a game</div>
        <p className="text-xs text-slate-400">Any date — use it when the usual day isn't available or for an extra game.</p>
        <div className="space-y-1.5">
          <Label htmlFor="sg-date">Date</Label>
          <Input id="sg-date" type="date" data-testid="schedule-game-date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sg-time">Time</Label>
          <Input id="sg-time" type="time" data-testid="schedule-game-time" value={f.time ?? ""} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sg-venue">Venue</Label>
          <Input id="sg-venue" data-testid="schedule-game-venue" value={f.venue ?? ""} onChange={(e) => setF({ ...f, venue: e.target.value })} />
        </div>
        <JerseyPicker labelA="Team A" labelB="Team B" a={f.jersey_a ?? null} b={f.jersey_b ?? null} testPrefix="schedule-jersey"
          onChange={(a, b) => setF({ ...f, jersey_a: a, jersey_b: b })} />
        <Button data-testid="schedule-game-submit" className="w-full bg-brand text-white" disabled={!f.date || act.isPending} onClick={schedule}>
          Schedule game
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Upcoming games</div>
        {games.length === 0 && <p className="text-sm text-slate-500">No upcoming games.</p>}
        {games.map((g) => (
          <div key={g.id} data-testid={`scheduled-game-${g.id}`} className="rounded-xl border border-line bg-surface p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{fmtDate(g.date, "EEE d MMM")} · {g.time}</div>
                <div className="truncate text-xs text-slate-400">{g.venue || "Venue TBA"} · {g.roster.length}/{g.max_players} joined</div>
                {(g.jersey_a || g.jersey_b) && (
                  <div className="mt-0.5 flex gap-3"><span className="text-[10px] text-slate-500">A</span><JerseyChip jersey={g.jersey_a} /><span className="text-[10px] text-slate-500">B</span><JerseyChip jersey={g.jersey_b} /></div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Move game"
                  data-testid={`game-move-${g.id}`}
                  onClick={() => {
                    setEditing(editing === g.id ? null : g.id);
                    setEdit({ date: g.date, time: g.time, venue: g.venue, jersey_a: g.jersey_a, jersey_b: g.jersey_b });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Cancel game"
                  data-testid={`game-cancel-${g.id}`}
                  onClick={() => {
                    const msg = g.roster.length
                      ? `Cancel the ${fmtDate(g.date, "EEE d MMM")} game? ${g.roster.length} name(s) on the roster will be removed.`
                      : `Cancel the ${fmtDate(g.date, "EEE d MMM")} game?`;
                    if (window.confirm(msg)) act.mutate(() => apiDelete(`/games/${g.id}`), { onSuccess: () => toast("Game cancelled") });
                  }}
                >
                  <CalendarX2 className="size-4 text-red-400" />
                </Button>
              </div>
            </div>
            {editing === g.id && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <Input type="date" aria-label="New date" data-testid={`game-move-date-${g.id}`} value={edit.date ?? ""} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
                <Input type="time" aria-label="New time" data-testid={`game-move-time-${g.id}`} value={edit.time ?? ""} onChange={(e) => setEdit({ ...edit, time: e.target.value })} />
                <Input aria-label="Venue" placeholder="Venue" data-testid={`game-move-venue-${g.id}`} value={edit.venue ?? ""} onChange={(e) => setEdit({ ...edit, venue: e.target.value })} />
                <JerseyPicker labelA="Team A" labelB="Team B" a={edit.jersey_a ?? null} b={edit.jersey_b ?? null} testPrefix={`game-move-jersey-${g.id}`}
                  onChange={(a, b) => setEdit({ ...edit, jersey_a: a, jersey_b: b })} />
                <Button
                  size="sm"
                  className="w-full"
                  data-testid={`game-move-save-${g.id}`}
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate(() => apiPatch<Game>(`/games/${g.id}`, edit), {
                      onSuccess: () => {
                        toast.success("Game updated — players keep their spots");
                        setEditing(null);
                      },
                    })
                  }
                >
                  Save changes
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
