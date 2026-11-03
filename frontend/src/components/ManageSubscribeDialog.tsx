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

// OMR 1 per 30 days — sends the host to Thawani Pay's secure checkout, Manage unlocks when they return paid.
export default function ManageSubscribeDialog({ community, onOpenChange }: Props) {
  const pay = useMutation({ mutationFn: () => startManageCheckout(community!.id), onError: (e) => toast.error(errMsg(e)) });
  return (
    <Dialog open={!!community} onOpenChange={onOpenChange}>
      <DialogContent data-testid="manage-subscribe-dialog" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">Unlock Manage</DialogTitle>
          <DialogDescription>
            OMR 1 for 30 days of full Manage for {community?.name}, including hosting tournaments and uploading photos. Pay again every 30 days — paying early adds to your current period. Paid securely by card through Thawani Pay.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm text-slate-300">
          {MANAGE_PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2"><BadgeCheck className="size-4 text-energy" />{p}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button data-testid="manage-subscribe-confirm" className="w-full bg-brand text-white" disabled={pay.isPending} onClick={() => pay.mutate()}>
            <Lock className="size-4" /> {pay.isPending ? "Opening secure checkout…" : "Pay OMR 1 · 30 days"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
