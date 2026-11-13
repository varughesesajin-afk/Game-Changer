import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, RotateCcw } from "lucide-react";
import { uploadImage } from "@/lib/image";
import { errMsg, sportImage } from "@/lib/auth";

interface Props {
  sport: string;
  value: string | null | undefined;
  onChange: (url: string) => void; // "" resets to the sport's default photo
  testid: string;
}

export default function CoverPhotoPicker({ sport, value, onChange, testid }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo");
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadImage(file, 1600));
      toast.success("Cover photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error && !("status" in e) ? "Couldn't read that photo" : errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        data-testid={`${testid}-button`}
        onClick={() => input.current?.click()}
        disabled={busy}
        className="group relative block h-40 w-full overflow-hidden rounded-2xl border border-line"
      >
        <img src={sportImage(sport, value)} alt="Community cover" data-testid={`${testid}-preview`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
          <Camera className="size-4" /> {busy ? "Uploading…" : value ? "Change photo" : "Upload cover photo"}
        </span>
      </button>
      {value && (
        <button type="button" data-testid={`${testid}-reset`} onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <RotateCcw className="size-3" /> Use default {sport.toLowerCase()} photo
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid={`${testid}-input`} onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
