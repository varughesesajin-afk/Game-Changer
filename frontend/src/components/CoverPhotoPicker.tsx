import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Move, RotateCcw, ZoomIn } from "lucide-react";
import { uploadImage } from "@/lib/image";
import { errMsg, sportImage } from "@/lib/auth";

export interface CoverPos {
  x: number; // focal point, % from the left
  y: number; // focal point, % from the top
  zoom: number; // 1 - 3
}

interface Props {
  sport: string;
  value: string | null | undefined;
  onChange: (url: string) => void; // "" resets to the sport's default photo
  pos?: CoverPos;
  onPos?: (p: CoverPos) => void;
  testid: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function CoverPhotoPicker({ sport, value, onChange, pos = { x: 50, y: 50, zoom: 1 }, onPos, testid }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
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
      onPos?.({ x: 50, y: 50, zoom: 1 }); // a new photo starts centred
      toast.success("Cover photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error && !("status" in e) ? "Couldn't read that photo" : errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  // How far the photo overhangs the frame (px) once it covers it — dragging moves it by that much at most.
  const overhang = () => {
    const f = frame.current, i = img.current;
    if (!f || !i || !i.naturalWidth) return { x: f?.clientWidth ?? 1, y: f?.clientHeight ?? 1 };
    const s = Math.max(f.clientWidth / i.naturalWidth, f.clientHeight / i.naturalHeight);
    return { x: Math.max(i.naturalWidth * s - f.clientWidth, 1), y: Math.max(i.naturalHeight * s - f.clientHeight, 1) };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!onPos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !onPos) return;
    const o = overhang();
    // dragging the photo right shows more of its left side, so the focal point moves the other way
    onPos({ ...pos, x: clamp(d.x - ((e.clientX - d.px) / o.x) * 100, 0, 100), y: clamp(d.y - ((e.clientY - d.py) / o.y) * 100, 0, 100) });
  };
  const onUp = () => { drag.current = null; };

  const moved = pos.x !== 50 || pos.y !== 50 || pos.zoom !== 1;

  return (
    <div className="space-y-2">
      <div
        ref={frame}
        data-testid={`${testid}-frame`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ touchAction: onPos ? "none" : undefined }}
        className={`relative h-40 w-full select-none overflow-hidden rounded-2xl border border-line ${onPos ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <div className="h-full w-full" style={{ transform: `scale(${pos.zoom})`, transformOrigin: `${pos.x}% ${pos.y}%` }}>
          <img
            ref={img}
            src={sportImage(sport, value)}
            alt="Community cover"
            draggable={false}
            data-testid={`${testid}-preview`}
            style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
            className="h-full w-full object-cover"
          />
        </div>
        {onPos && (
          <span className="on-dark pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Move className="size-3.5" /> Drag to reposition
          </span>
        )}
      </div>

      {onPos && (
        <label className="flex items-center gap-2.5 text-xs text-slate-400">
          <ZoomIn className="size-4 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={pos.zoom}
            data-testid={`${testid}-zoom`}
            aria-label="Zoom"
            onChange={(e) => onPos({ ...pos, zoom: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer accent-emerald-500"
          />
          <span className="w-9 text-right tabular-nums">{pos.zoom.toFixed(1)}×</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <button
          type="button"
          data-testid={`${testid}-button`}
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-slate-500"
        >
          <Camera className="size-4" /> {busy ? "Uploading…" : value ? "Change photo" : "Upload cover photo"}
        </button>
        {onPos && moved && (
          <button type="button" data-testid={`${testid}-recentre`} onClick={() => onPos({ x: 50, y: 50, zoom: 1 })} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
            <RotateCcw className="size-3" /> Reset framing
          </button>
        )}
        {value && (
          <button type="button" data-testid={`${testid}-reset`} onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
            <RotateCcw className="size-3" /> Use default {sport.toLowerCase()} photo
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500">Cards and the banner crop the photo to fit, so frame the part you want people to see.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid={`${testid}-input`} onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
