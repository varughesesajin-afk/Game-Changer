import { cn } from "@/lib/utils";

export default function Avatar({ name, picture, className }: { name: string; picture?: string | null; className?: string }) {
  if (picture) return <img src={picture} alt="" className={cn("size-6 shrink-0 rounded-full object-cover", className)} />;
  return (
    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full bg-energy/20 text-[10px] font-bold uppercase text-energy", className)}>
      {name.trim()[0] ?? "?"}
    </span>
  );
}
