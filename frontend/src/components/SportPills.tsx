import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/auth";

interface Props {
  value: string;
  onChange: (s: string) => void;
  includeAll?: boolean;
  testPrefix?: string;
  wrap?: boolean; // wrap onto rows (forms) instead of a sideways-scrolling strip
}

export default function SportPills({ value, onChange, includeAll = true, testPrefix = "sport-filter", wrap = false }: Props) {
  const list = includeAll ? ["All", ...SPORTS] : SPORTS;
  return (
    <div className={cn(wrap ? "grid grid-cols-3 gap-2" : "no-scrollbar -mx-5 flex touch-pan-x gap-2 overflow-x-auto overscroll-x-contain px-5 py-1")}>
      {list.map((s) => (
        <button
          key={s}
          type="button"
          data-testid={`${testPrefix}-${s.toLowerCase()}`}
          onClick={() => onChange(s)}
          className={cn(
            // every sport pill is the same size everywhere in the app
            "flex h-9 w-[6.5rem] shrink-0 items-center justify-center truncate rounded-full border px-2 text-sm font-semibold transition-[background-color,color,border-color,transform] duration-200 active:scale-95",
            wrap && "w-full",
            value === s
              ? "border-transparent bg-brand text-white"
              : "border-line bg-surface text-slate-300 hover:border-slate-500",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
