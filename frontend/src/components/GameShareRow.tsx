import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { apiGet } from "@/lib/api";
import { buildGameText, copyText } from "@/lib/gameText";
import type { Community, Game } from "@/lib/types";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.9L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15.1 3.6 13.6 3.6 12c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4-3.8 8.2-8.4 8.2z" />
    </svg>
  );
}

/** "Copy list" and "Share" under a game card: a ready-made message for the WhatsApp group. */
export default function GameShareRow({ game }: { game: Game }) {
  const cq = useQuery({ queryKey: ["community", game.community_id], queryFn: () => apiGet<Community>(`/communities/${game.community_id}`), staleTime: 60_000 });
  const text = () => buildGameText(game, cq.isError ? null : cq.data);
  return (
    <div className="mt-2 flex gap-2" data-testid={`game-share-${game.id}`}>
      <button
        type="button"
        data-testid={`game-copy-${game.id}`}
        onClick={async () => (await copyText(text())) ? toast.success("Copied — paste it into your WhatsApp group") : toast.error("Couldn't copy — use Share instead")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand px-3 text-sm font-bold text-white shadow-md shadow-sky-700/25 transition-transform active:scale-[0.98]"
      >
        <Copy className="size-4" /> Copy list
      </button>
      <button
        type="button"
        data-testid={`game-whatsapp-${game.id}`}
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank", "noopener,noreferrer")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-line bg-surface px-3 text-sm font-bold text-[#128C5E] transition-transform active:scale-[0.98]"
      >
        <WhatsAppIcon className="size-4" /> Share
      </button>
    </div>
  );
}
