import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.9L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15.1 3.6 13.6 3.6 12c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4-3.8 8.2-8.4 8.2z" />
    </svg>
  );
}

interface Props {
  path: string; // e.g. /communities/123
  text: string; // message lead-in
  testid: string;
  className?: string;
}

export default function ShareButtons({ path, text, testid, className }: Props) {
  const url = window.location.origin + path;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast(url);
    }
  };
  return (
    <div className={cn("flex gap-2", className)}>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`${testid}-whatsapp`}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-1.5 text-sm font-semibold text-[#062B16] transition-transform duration-150 active:scale-95"
      >
        <WhatsAppIcon className="size-4" /> Share
      </a>
      <button
        type="button"
        onClick={copy}
        data-testid={`${testid}-copy`}
        aria-label="Copy link"
        className="inline-flex items-center rounded-full bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur transition-colors hover:bg-black/60"
      >
        <Link2 className="size-4" />
      </button>
    </div>
  );
}
