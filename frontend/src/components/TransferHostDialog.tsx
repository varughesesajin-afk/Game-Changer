import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Avatar from "@/components/Avatar";
import { apiPost } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Community } from "@/lib/types";

// The host (or the site admin) hands the community to another member. Takes effect straight away.
export default function TransferHostDialog({ c, open, onOpenChange }: { c: Community; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const candidates = c.members.filter((m) => m.user_id !== c.owner_id);
  const chosen = candidates.find((m) => m.user_id === pick);

  const go = useMutation({
    mutationFn: () => apiPost(`/communities/${c.id}/transfer-host`, { user_id: pick }),
    onSuccess: () => {
      toast.success(`${chosen?.name ?? "The new host"} is now the host of ${c.name}`);
      onOpenChange(false);
      setPick(null);
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPick(null); }}>
      <DialogContent data-testid="transfer-host-dialog" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Transfer host</DialogTitle>
          <DialogDescription>
            Choose a member to become the host of {c.name}. They take over straight away, with the same approval and the days left of Manage. You stay in the community as a member.
          </DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-slate-400">
            There is no one to hand it to yet. Approve a player's request to join first, then come back.
          </p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto" data-testid="transfer-host-list">
            {candidates.map((m) => (
              <button
                key={m.user_id}
                type="button"
                data-testid={`transfer-host-pick-${m.user_id}`}
                onClick={() => setPick(m.user_id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition-colors",
                  pick === m.user_id ? "border-energy bg-energy/10" : "border-line bg-surface hover:border-slate-500",
                )}
              >
                <Avatar name={m.name} picture={m.picture} className="size-7" />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {pick === m.user_id && <Crown className="size-4 text-amber-500" />}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="transfer-host-confirm" className="flex-1 bg-brand text-white" disabled={!pick || go.isPending} onClick={() => go.mutate()}>
            {go.isPending ? "Transferring…" : "Transfer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
