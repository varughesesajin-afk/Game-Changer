import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { apiPut } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import { uploadImage } from "@/lib/image";
import { queryClient } from "@/lib/queryClient";
import type { PictureIn, User } from "@/lib/types";

/** Tap to upload your own profile picture (shown on rosters, members and leaderboards). */
export default function ProfilePicture({ me }: { me: User }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, 512);
      const u = await apiPut<User>("/auth/me/picture", { picture: url } satisfies PictureIn);
      queryClient.setQueryData(["me"], u);
      refreshAll();
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
    <button
      type="button"
      data-testid="profile-picture-button"
      aria-label="Change profile picture"
      disabled={busy}
      onClick={() => input.current?.click()}
      className="group relative size-16 shrink-0 overflow-hidden rounded-2xl"
    >
      {me.picture ? (
        <img src={me.picture} alt="" data-testid="profile-picture-img" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-brand font-heading text-2xl font-bold text-white">{me.name[0]}</div>
      )}
      <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-black/55 py-0.5 transition-colors group-hover:bg-black/70">
        <Camera className="size-3.5 text-white" />
      </span>
      {busy && <span className="absolute inset-0 animate-pulse bg-black/40" />}
    </button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="profile-picture-input" onChange={(e) => void pick(e.target.files?.[0])} />
    </>
  );
}
