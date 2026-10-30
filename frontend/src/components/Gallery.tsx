import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import { uploadImage } from "@/lib/image";
import type { GalleryPhoto, GalleryPhotoIn } from "@/lib/types";

export default function Gallery({ communityId, isHost }: { communityId: string; isHost: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<GalleryPhoto | null>(null);
  const q = useQuery({ queryKey: ["gallery", communityId], queryFn: () => apiGet<GalleryPhoto[]>(`/communities/${communityId}/gallery`) });
  const photos = q.isError ? [] : q.data ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/gallery/${id}`),
    onSuccess: () => {
      toast("Photo removed");
      setOpen(null);
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const url = await uploadImage(file, 1600);
        await apiPost<GalleryPhoto>(`/communities/${communityId}/gallery`, { url, caption: "" } satisfies GalleryPhotoIn);
        ok += 1;
      } catch (e) {
        toast.error(errMsg(e));
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (ok) toast.success(`${ok} photo${ok === 1 ? "" : "s"} added to the gallery`);
    refreshAll();
  };

  return (
    <section className="space-y-3 pb-4" data-testid="community-gallery">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold uppercase tracking-wide">Gallery</h2>
        {isHost && (
          <button
            type="button"
            data-testid="gallery-add-button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-95 disabled:opacity-60"
          >
            <ImagePlus className="size-4" /> {busy ? "Uploading…" : "Add photos"}
          </button>
        )}
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="gallery-file-input" onChange={(e) => void add(e.target.files)} />
      </div>
      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">
          {isHost ? "Share match-day photos with your members." : "No photos yet."}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <button key={p.id} type="button" data-testid={`gallery-photo-${p.id}`} onClick={() => setOpen(p)} className="aspect-square overflow-hidden rounded-lg">
              <img src={p.url} alt={p.caption || "Community photo"} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div data-testid="gallery-viewer" className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-slate-400">{open.uploaded_by_name} · {fmtDate(open.created_at, "d MMM yyyy")}</span>
            <div className="flex gap-2">
              {isHost && (
                <button
                  type="button"
                  aria-label="Delete photo"
                  data-testid="gallery-delete-button"
                  onClick={() => window.confirm("Remove this photo?") && remove.mutate(open.id)}
                  className="rounded-full bg-white/10 p-2 text-red-300 hover:bg-white/20"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button type="button" aria-label="Close" data-testid="gallery-close-button" onClick={() => setOpen(null)} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center p-2">
            <img src={open.url} alt={open.caption || "Community photo"} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </section>
  );
}
