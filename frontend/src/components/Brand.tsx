import { cn } from "@/lib/utils";

export default function Brand({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 leading-none", className)} data-testid="app-brand">
      <img src="/logo-icon.png" alt="Green Ocean Sporting Events logo" className="size-10 rounded-xl object-cover shadow-lg shadow-black/40 ring-1 ring-white/10" />
      <div>
        <div className="font-heading text-lg font-black tracking-tight">
          <span className="text-brand">Green Ocean</span>
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-300">
          Sporting Events{tagline && <span className="text-energy"> · Game on</span>}
        </div>
      </div>
    </div>
  );
}
