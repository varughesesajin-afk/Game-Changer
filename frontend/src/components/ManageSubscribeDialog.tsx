import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errMsg } from "@/lib/auth";
import { startManageCheckout } from "@/lib/payments";
import type { Community } from "@/lib/types";

export const MANAGE_PERKS = [
  "Edit community details",
  "Schedule weekly games",
  "Host community tournaments",
  "Remove members & roster names",
  "Track who has paid match fees",
];

interface Props {
  community: Community | null;
  onOpenChange: (o: boolean) => void;
}

// One-time OMR 1 — sends the host to Thawani Pay's secure checkout, Manage unlocks when they return paid.
export default function ManageSubscribeDialog({ community, onOpenChange }: Props) {
  const pay = useMutation({ mutationFn: () => startManageCheckout(community!.id), onError: (e) => toast.error(errMsg(e)) });
  return (
    <Dialog open={!!community} onOpenChange={onOpenChange}>
      <DialogContent data-testid="manage-subscribe-dialog" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">Unlock Manage</DialogTitle>
          <DialogDescription>
            One-time OMR 1 for {community?.name} — pay once, manage it for good. Paid securely by card through Thawani Pay.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm text-slate-300">
          {MANAGE_PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2"><BadgeCheck className="size-4 text-energy" />{p}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button data-testid="manage-subscribe-confirm" className="w-full bg-brand text-white" disabled={pay.isPending} onClick={() => pay.mutate()}>
            <Lock className="size-4" /> {pay.isPending ? "Opening secure checkout…" : "Pay OMR 1 once"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
