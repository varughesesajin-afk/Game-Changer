import { Shield } from "lucide-react";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TeamBadge({ team, className }: { team?: Team | null; className?: string }) {
  if (team?.logo) return <img src={team.logo} alt="" className={cn("size-6 shrink-0 rounded-md object-cover", className)} />;
  return (
    <span className={cn("grid size-6 shrink-0 place-items-center rounded-md bg-ice/15 text-ice", className)}>
      <Shield className="size-3.5" />
    </span>
  );
}
