import { Shirt } from "lucide-react";
import type { Jersey } from "@/lib/types";
import { cn } from "@/lib/utils";

export const JERSEYS: { name: Exclude<Jersey, null>; hex: string }[] = [
  { name: "White", hex: "#F8FAFC" },
  { name: "Black", hex: "#0B0F14" },
  { name: "Red", hex: "#DC2626" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Navy", hex: "#1E3A8A" },
  { name: "Sky", hex: "#38BDF8" },
  { name: "Green", hex: "#16A34A" },
  { name: "Yellow", hex: "#FACC15" },
  { name: "Orange", hex: "#F97316" },
  { name: "Purple", hex: "#7C3AED" },
  { name: "Maroon", hex: "#7F1D1D" },
  { name: "Grey", hex: "#6B7280" },
];
const hexOf = (j: Jersey) => JERSEYS.find((x) => x.name === j)?.hex;

/** Small kit chip: shirt icon in the jersey colour + name. */
export function JerseyChip({ jersey, testId, className }: { jersey: Jersey; testId?: string; className?: string }) {
  if (!jersey) return null;
  return (
    <span data-testid={testId} className={cn("inline-flex items-center gap-1 text-[10px] font-semibold normal-case tracking-normal text-slate-300", className)}>
      <Shirt className="size-3.5" style={{ color: hexOf(jersey), fill: hexOf(jersey) }} strokeWidth={1.5} stroke="#94A3B8" />
      {jersey}
    </span>
  );
}

/** Host picks a kit colour for each side. Tap the selected colour again to clear it. */
export function JerseyPicker({ labelA, labelB, a, b, onChange, testPrefix }: {
  labelA: string;
  labelB: string;
  a: Jersey;
  b: Jersey;
  onChange: (a: Jersey, b: Jersey) => void;
  testPrefix: string;
}) {
  const Row = ({ side, label, value }: { side: "a" | "b"; label: string; value: Jersey }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-400">{value ?? "No colour"}</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {JERSEYS.map((j) => {
          const on = value === j.name;
          const clash = (side === "a" ? b : a) === j.name;
          return (
            <button
              key={j.name}
              type="button"
              aria-label={`${label} jersey ${j.name}`}
              aria-pressed={on}
              title={clash ? `${j.name} — same as the other team` : j.name}
              data-testid={`${testPrefix}-${side}-${j.name.toLowerCase()}`}
              onClick={() => (side === "a" ? onChange(on ? null : j.name, b) : onChange(a, on ? null : j.name))}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg border transition-[transform,border-color,box-shadow] duration-150 active:scale-95",
                on ? "border-ice ring-2 ring-ice/60" : "border-line",
                clash && !on && "opacity-40",
              )}
              style={{ backgroundColor: j.hex }}
            >
              {on && <span className={cn("size-2 rounded-full", ["White", "Yellow", "Sky"].includes(j.name) ? "bg-slate-900" : "bg-[#ffffff]")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div data-testid={`${testPrefix}-picker`} className="space-y-3 rounded-xl border border-line bg-elevated/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400"><Shirt className="size-3.5" /> Jersey colours</div>
      <Row side="a" label={labelA} value={a} />
      <Row side="b" label={labelB} value={b} />
      {a && a === b && <p className="text-xs text-amber-300">Both teams are wearing {a} — pick different colours so players can tell them apart.</p>}
    </div>
  );
}
