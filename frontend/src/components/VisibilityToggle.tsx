import { Globe, Lock } from "lucide-react";
import type { Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTS: { id: Visibility; label: string; desc: string; icon: typeof Globe }[] = [
  { id: "open", label: "Open", desc: "Anyone signed in can join a team in your games", icon: Globe },
  { id: "private", label: "Private", desc: "Only members you approve can join your games", icon: Lock },
];

export default function VisibilityToggle({ value, onChange, testid }: { value: Visibility; onChange: (v: Visibility) => void; testid: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTS.map(({ id, label, desc, icon: Icon }) => (
        <button
          key={id}
          type="button"
          data-testid={`${testid}-${id}`}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-xl border p-3 text-left transition-[border-color,background-color] duration-150",
            value === id ? "border-energy bg-energy/10" : "border-line bg-surface hover:border-slate-500",
          )}
        >
          <div className="flex items-center gap-1.5 font-semibold"><Icon className="size-4 text-ice" /> {label}</div>
          <div className="mt-1 text-xs text-slate-400">{desc}</div>
        </button>
      ))}
    </div>
  );
}
