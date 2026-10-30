import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import TeamBadge from "@/components/TeamBadge";
import { apiPut } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import { uploadImage } from "@/lib/image";
import type { Team, TeamLogoIn, Tournament } from "@/lib/types";

/** Team badge; captains/organisers tap it to upload a logo. */
export default function TeamLogo({ t, team, canEdit }: { t: Tournament; team: Team; canEdit: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!canEdit) return <TeamBadge team={team} className="size-9" />;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const logo = await uploadImage(file, 256);
      await apiPut<Tournament>(`/tournaments/${t.id}/teams/${team.id}/logo`, { logo } satisfies TeamLogoIn);
      toast.success("Team badge updated");
      refreshAll();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <>
      <button type="button" aria-label="Upload team badge" data-testid={`team-logo-button-${team.id}`} disabled={busy} onClick={() => input.current?.click()} className="relative">
        <TeamBadge team={team} className="size-9" />
        <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-brand"><Camera className="size-2.5 text-white" /></span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid={`team-logo-input-${team.id}`} onChange={(e) => void pick(e.target.files?.[0])} />
    </>
  );
}
