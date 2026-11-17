import { Check } from "lucide-react";
import type { SignupStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: SignupStyle;
  onChange: (v: SignupStyle) => void;
  testid: string;
}

/** How players put their name down for a game: pick a team, or take a numbered spot. */
export default function SignupStyleToggle({ value, onChange, testid }: Props) {
  const Card = ({ id, title, text, children }: { id: SignupStyle; title: string; text: string; children: React.ReactNode }) => {
    const on = value === id;
    return (
      <button
        type="button"
        data-testid={`${testid}-${id}`}
        aria-pressed={on}
        onClick={() => onChange(id)}
        className={cn(
          "w-full rounded-2xl border-2 p-3 text-left transition-colors",
          on ? "border-transparent gradient-card shadow-md shadow-emerald-500/15" : "border-line bg-surface hover:border-slate-500",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-sm font-bold">{title}</span>
          <span className={cn("grid size-5 place-items-center rounded-full", on ? "bg-energy text-white" : "border-2 border-line")}>{on && <Check className="size-3" />}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{text}</p>
        {children}
      </button>
    );
  };
  return (
    <div className="space-y-2" data-testid={testid}>
      <Card id="teams" title="Join Team A / Team B" text="Players pick a side when they join.">
        <div className="mt-2 flex gap-2 text-[10px] font-bold">
          <span className="flex-1 rounded-lg bg-elevated py-1.5 text-center text-ice">Team A</span>
          <span className="flex-1 rounded-lg bg-elevated py-1.5 text-center text-ice">Team B</span>
        </div>
      </Card>
      <Card id="spots" title="Numbered spots" text="One circle per place. Tap a free number to take it, or to add a name. You split the teams later.">
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <span key={n} className={cn("grid size-5 place-items-center rounded-full text-[9px] font-bold", n <= 6 ? "bg-brand text-white" : "border border-line text-slate-400")}>{n}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
