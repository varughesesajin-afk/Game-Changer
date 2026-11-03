import { useState, type ReactNode } from "react";
import { AlarmClock, Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared match sheet for tournament fixtures and community games.
 *  A side's `key` is a team id (tournaments) or "A"/"B" (community games); a player's `id` is the squad name or roster entry id. */
export interface SheetPlayer {
  id: string;
  name: string;
}
export interface SheetSide {
  key: string;
  name: string;
  badge?: ReactNode;
  players: SheetPlayer[];
}
export interface SheetEvent {
  team: string;
  scorer: string | null;
  assist: string | null;
}
export interface SheetValue {
  events: SheetEvent[];
  late: string[]; // `${side}::${player}`
  paid: string[];
  motm: string | null;
}

export const pk = (side: string, id: string) => `${side}::${id}`;
const split = (k: string) => {
  const i = k.indexOf("::");
  return [k.slice(0, i), k.slice(i + 2)] as const;
};
export { split as splitKey };

/** Fill a sheet from older results that only stored goal totals: goals become events without assists, the rest of the score "Unassigned". */
export function eventsFromTotals(side: string, totals: { id: string; goals: number }[], score: number | null): SheetEvent[] {
  const ev: SheetEvent[] = totals.flatMap((t) => Array.from({ length: t.goals }, () => ({ team: side, scorer: t.id, assist: null })));
  for (let i = ev.length; i < (score ?? 0); i++) ev.push({ team: side, scorer: null, assist: null });
  return ev;
}

const selectCls =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-elevated px-2 text-sm text-white outline-none transition-[border-color] duration-150 focus:border-ice";

interface Props {
  sides: [SheetSide, SheetSide];
  initial: SheetValue;
  canManage: boolean;
  saving: boolean;
  onSave: (v: SheetValue) => void;
  note?: string;
}

export default function MatchSheet({ sides, initial, canManage, saving, onSave, note }: Props) {
  const [v, setV] = useState<SheetValue>(initial);
  const nameOf = (side: string, id: string | null) => (id ? sides.find((s) => s.key === side)?.players.find((p) => p.id === id)?.name ?? id : "Unassigned goal");
  const score = (side: string) => v.events.filter((e) => e.team === side).length;
  const toggle = (list: "late" | "paid", k: string) =>
    setV((s) => ({ ...s, [list]: s[list].includes(k) ? s[list].filter((x) => x !== k) : [...s[list], k] }));

  if (!canManage) return <MatchSummary sides={sides} value={initial} />;

  return (
    <div data-testid="match-sheet" className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <span className="truncate text-sm font-semibold">{sides[0].name}</span>
        <span data-testid="match-sheet-score" className="rounded-lg bg-elevated px-3 py-1 font-heading text-2xl font-bold">
          {score(sides[0].key)} – {score(sides[1].key)}
        </span>
        <span className="truncate text-sm font-semibold">{sides[1].name}</span>
      </div>
      {note && <p className="text-xs text-slate-500">{note}</p>}

      {sides.map((side) => (
        <SideCard
          key={side.key}
          side={side}
          value={v}
          nameOf={nameOf}
          onAddGoal={(e) => setV((s) => ({ ...s, events: [...s.events, e] }))}
          onRemoveGoal={(idx) => setV((s) => ({ ...s, events: s.events.filter((_, i) => i !== idx) }))}
          onToggle={toggle}
        />
      ))}

      <div className="space-y-1.5 rounded-2xl border border-line bg-surface p-3">
        <label htmlFor="sheet-motm" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          <Star className="size-3.5 text-amber-400" /> Man of the Match
        </label>
        <select id="sheet-motm" data-testid="sheet-motm-select" className={selectCls} value={v.motm ?? ""} onChange={(e) => setV({ ...v, motm: e.target.value || null })}>
          <option value="">No pick</option>
          {sides.map((s) => (
            <optgroup key={s.key} label={s.name}>
              {s.players.map((p) => <option key={p.id} value={pk(s.key, p.id)}>{p.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <Button data-testid="sheet-save" className="h-11 w-full bg-brand text-white" disabled={saving} onClick={() => onSave(v)}>
        {saving ? "Saving…" : "Save match sheet"}
      </Button>
    </div>
  );
}

function SideCard({ side, value, nameOf, onAddGoal, onRemoveGoal, onToggle }: {
  side: SheetSide;
  value: SheetValue;
  nameOf: (side: string, id: string | null) => string;
  onAddGoal: (e: SheetEvent) => void;
  onRemoveGoal: (idx: number) => void;
  onToggle: (list: "late" | "paid", k: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [scorer, setScorer] = useState("");
  const [assist, setAssist] = useState("");
  const goals = value.events.map((e, i) => ({ e, i })).filter((x) => x.e.team === side.key);
  const late = side.players.filter((p) => value.late.includes(pk(side.key, p.id)));
  const tid = side.key.toLowerCase();

  return (
    <section data-testid={`sheet-side-${tid}`} className="space-y-3 rounded-2xl border border-line bg-surface p-3">
      <header className="flex items-center justify-between">
        <span className="flex min-w-0 items-center gap-2 font-heading text-sm font-bold uppercase tracking-wide">
          {side.badge}
          <span className="truncate">{side.name}</span>
        </span>
        <span data-testid={`sheet-side-score-${tid}`} className="font-heading text-xl font-bold text-energy">{goals.length}</span>
      </header>

      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Goals</div>
        {goals.length === 0 && <p className="text-xs text-slate-500">No goals yet.</p>}
        {goals.map(({ e, i }, n) => (
          <div key={i} data-testid={`sheet-goal-${tid}-${n}`} className="flex items-center justify-between gap-2 rounded-lg bg-elevated/60 px-3 py-1.5 text-sm">
            <span className="min-w-0 truncate">
              ⚽ <span className={cn("font-semibold", !e.scorer && "italic text-slate-400")}>{nameOf(side.key, e.scorer)}</span>
              {e.assist && <span className="text-slate-400"> · 🅰 {nameOf(side.key, e.assist)}</span>}
            </span>
            <button type="button" aria-label="Remove goal" data-testid={`sheet-goal-remove-${tid}-${n}`} onClick={() => onRemoveGoal(i)}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-line hover:text-red-400">
              <X className="size-4" />
            </button>
          </div>
        ))}
        {adding ? (
          <div className="space-y-2 rounded-xl border border-ice/40 bg-elevated/40 p-2">
            <select aria-label="Scorer" data-testid={`sheet-scorer-select-${tid}`} className={selectCls} value={scorer}
              onChange={(e) => { setScorer(e.target.value); if (e.target.value === assist) setAssist(""); }}>
              <option value="">Choose scorer</option>
              {side.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__none__">Unassigned goal (e.g. own goal)</option>
            </select>
            <select aria-label="Assisted by" data-testid={`sheet-assist-select-${tid}`} className={selectCls} value={assist} onChange={(e) => setAssist(e.target.value)}>
              <option value="">No assist</option>
              {side.players.filter((p) => p.id !== scorer).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" data-testid={`sheet-goal-cancel-${tid}`} onClick={() => { setAdding(false); setScorer(""); setAssist(""); }}>Cancel</Button>
              <Button size="sm" className="bg-energy text-slate-950" data-testid={`sheet-goal-confirm-${tid}`} disabled={!scorer}
                onClick={() => {
                  onAddGoal({ team: side.key, scorer: scorer === "__none__" ? null : scorer, assist: assist || null });
                  setScorer(""); setAssist(""); setAdding(false);
                }}>
                Add goal
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-10 w-full border-dashed" data-testid={`sheet-add-goal-${tid}`} onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add goal
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_3.5rem_4.5rem] items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          <span>Players</span><span className="text-center">Late</span><span className="text-center">Paid</span>
        </div>
        {side.players.length === 0 && <p className="text-xs text-slate-500">No players registered for this team.</p>}
        {side.players.map((p) => {
          const k = pk(side.key, p.id);
          const isLate = value.late.includes(k);
          const isPaid = value.paid.includes(k);
          return (
            <div key={p.id} className="grid grid-cols-[1fr_3.5rem_4.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm">
              <span className="truncate">{p.name}</span>
              <button type="button" aria-label={`Late: ${p.name}`} aria-pressed={isLate} data-testid={`sheet-late-${tid}-${p.id}`} onClick={() => onToggle("late", k)}
                className={cn("mx-auto flex size-9 items-center justify-center rounded-lg border transition-[background-color,border-color,color] duration-150",
                  isLate ? "border-amber-400 bg-amber-400/15 text-amber-300" : "border-line text-slate-600")}>
                <AlarmClock className="size-4" />
              </button>
              <button type="button" aria-pressed={isPaid} data-testid={`sheet-paid-${tid}-${p.id}`} onClick={() => onToggle("paid", k)}
                className={cn("h-9 rounded-full text-xs font-bold transition-[background-color,color] duration-150 active:scale-95",
                  isPaid ? "bg-energy text-slate-950" : "bg-elevated text-slate-400")}>
                {isPaid ? "Paid" : "Unpaid"}
              </button>
            </div>
          );
        })}
        {late.length > 0 && <p data-testid={`sheet-late-summary-${tid}`} className="pt-1 text-xs text-amber-300">Late: {late.map((p) => p.name).join(", ")}</p>}
      </div>
    </section>
  );
}

/** Read-only view for players and captains. */
export function MatchSummary({ sides, value }: { sides: [SheetSide, SheetSide]; value: SheetValue }) {
  const nm = (side: SheetSide, id: string | null) => (id ? side.players.find((p) => p.id === id)?.name ?? id : "Unassigned goal");
  const motm = value.motm ? split(value.motm) : null;
  const motmSide = motm ? sides.find((s) => s.key === motm[0]) : undefined;
  const lines = sides.flatMap((side) => {
    // group by scorer: "Ahmed ×2 (assist Salim)"
    const by = new Map<string, { scorer: string; count: number; assists: string[] }>();
    value.events.filter((e) => e.team === side.key).forEach((e, i) => {
      const key = e.scorer ?? `__u${i}`;
      const row = by.get(key) ?? { scorer: nm(side, e.scorer), count: 0, assists: [] };
      row.count += 1;
      if (e.assist) row.assists.push(nm(side, e.assist));
      by.set(key, row);
    });
    return [...by.values()].map((r) => ({ side: side.key, text: `${r.scorer}${r.count > 1 ? ` ×${r.count}` : ""}${r.assists.length ? ` (assist ${r.assists.join(", ")})` : ""}` }));
  });
  const late = sides
    .map((s) => ({ s, names: s.players.filter((p) => value.late.includes(pk(s.key, p.id))).map((p) => p.name) }))
    .filter((x) => x.names.length > 0);
  if (!lines.length && !motm && !late.length) return <p data-testid="match-summary-empty" className="text-sm text-slate-400">No match details recorded yet.</p>;
  return (
    <div data-testid="match-summary" className="space-y-1.5 rounded-2xl border border-line bg-surface p-3 text-sm">
      {lines.map((l, i) => <div key={i} data-testid={`match-summary-goal-${i}`}>⚽ {l.text}</div>)}
      {motm && motmSide && <div data-testid="match-summary-motm">⭐ Man of the Match: {nm(motmSide, motm[1])}</div>}
      {late.map((x) => <div key={x.s.key} data-testid={`match-summary-late-${x.s.key.toLowerCase()}`} className="text-amber-300">⏰ Late — {x.s.name}: {x.names.join(", ")}</div>)}
    </div>
  );
}
