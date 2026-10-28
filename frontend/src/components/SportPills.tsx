import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/auth";

interface Props {
  value: string;
  onChange: (s: string) => void;
  includeAll?: boolean;
  testPrefix?: string;
}

export default function SportPills({ value, onChange, includeAll = true, testPrefix = "sport-filter" }: Props) {
  const list = includeAll ? ["All", ...SPORTS] : SPORTS;
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
      {list.map((s) => (
        <button
          key={s}
          type="button"
          data-testid={`${testPrefix}-${s.toLowerCase()}`}
          onClick={() => onChange(s)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-[background-color,color,border-color,transform] duration-200 active:scale-95",
            value === s
              ? "border-energy bg-energy text-white"
              : "border-line bg-surface text-slate-300 hover:border-slate-500",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
