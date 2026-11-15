import { sportImage } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Community } from "@/lib/types";

interface Props {
  c?: Pick<Community, "sport" | "image" | "image_x" | "image_y" | "image_zoom"> | null;
  sport?: string; // used while the community is still loading
  alt?: string;
  className?: string; // sizes the frame (e.g. "h-full w-full" or "absolute inset-0")
  imgClassName?: string;
}

// A community cover photo framed the way its host chose: focal point + zoom.
export default function CoverImage({ c, sport, alt = "", className, imgClassName }: Props) {
  const x = c?.image_x ?? 50;
  const y = c?.image_y ?? 50;
  const zoom = c?.image_zoom ?? 1;
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="h-full w-full" style={{ transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` }}>
        <img src={sportImage(c?.sport ?? sport ?? "", c?.image)} alt={alt} style={{ objectPosition: `${x}% ${y}%` }} className={cn("h-full w-full object-cover", imgClassName)} />
      </div>
    </div>
  );
}
