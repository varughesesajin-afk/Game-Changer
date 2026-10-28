import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
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
  onActivated?: (c: Community) => void;
}

// PAYMENTS ARE MOCKED — confirming flips the subscription on without charging a card.
export default function ManageSubscribeDialog({ community, onOpenChange, onActivated }: Props) {
  const sub = useMutation({
    mutationFn: () => apiPost<Community>(`/billing/communities/${community?.id}/subscribe`),
    onSuccess: (c) => {
      toast.success("Manage activated for " + c.name);
      refreshAll();
      onOpenChange(false);
      onActivated?.(c);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!community} onOpenChange={onOpenChange}>
      <DialogContent data-testid="manage-subscribe-dialog" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">Unlock Manage</DialogTitle>
          <DialogDescription>
            OMR 1 / month for {community?.name}. Test mode — payments are simulated, no card is charged.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm text-slate-300">
          {MANAGE_PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2"><BadgeCheck className="size-4 text-energy" />{p}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button data-testid="manage-subscribe-confirm" className="w-full bg-brand text-white" disabled={sub.isPending} onClick={() => sub.mutate()}>
            <CreditCard className="size-4" /> {sub.isPending ? "Processing…" : "Pay OMR 1 & activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
