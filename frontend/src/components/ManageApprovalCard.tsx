import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Clock, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll } from "@/lib/auth";
import type { Community } from "@/lib/types";

export const MANAGE_PERKS = [
  "Edit community details",
  "Schedule weekly games",
  "Host community tournaments (each one is approved by the admin)",
  "Remove members & roster names",
  "Track who has paid match fees",
];

/** Where a host stands with the site admin: community approval, the current 30-day Manage period, and renewal requests. */
export default function ManageApprovalCard({ c }: { c: Community }) {
  const ask = useMutation({
    mutationFn: () => apiPost<Community>(`/communities/${c.id}/manage-request`),
    onSuccess: () => {
      toast.success("Request sent — the admin will review it");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (c.approval_status === "pending") {
    return (
      <div data-testid="community-approval-pending" className="flex gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
        <Clock className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div>
          <div className="font-semibold text-amber-200">Waiting for admin approval</div>
          <p className="mt-0.5 text-slate-300">Only you can see this community for now. Once the admin approves it, it goes live and you get 30 days of Manage.</p>
        </div>
      </div>
    );
  }
  if (c.approval_status === "declined") {
    return (
      <div data-testid="community-approval-declined" className="flex gap-3 rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-sm">
        <XCircle className="mt-0.5 size-5 shrink-0 text-red-300" />
        <div>
          <div className="font-semibold text-red-200">The admin didn't approve this community</div>
          <p className="mt-0.5 text-slate-300">It stays hidden from other players. Contact the admin if you think this is a mistake.</p>
        </div>
      </div>
    );
  }

  const until = c.manage_until ? fmtDate(c.manage_until, "d MMM yyyy") : "";
  return (
    <div data-testid="community-manage-status" className="space-y-3 rounded-2xl border border-energy/40 bg-gradient-to-r from-ice/10 to-energy/10 p-4 text-sm">
      <div className="flex gap-3">
        {c.manage_active ? <BadgeCheck className="mt-0.5 size-5 shrink-0 text-energy" /> : <Lock className="mt-0.5 size-5 shrink-0 text-energy" />}
        <div>
          {c.manage_active ? (
            <><span className="font-semibold text-energy">Manage approved until {until}.</span> Hosting a tournament always needs the admin's approval too.</>
          ) : (
            <><span className="font-semibold text-energy">Manage is locked.</span> {until ? `Your last period ended ${until}. ` : ""}Ask the admin to approve another 30 days to manage games, host tournaments and upload photos.</>
          )}
        </div>
      </div>
      {c.manage_requested_at ? (
        <div data-testid="manage-request-sent" className="rounded-xl bg-page/60 px-3 py-2 text-xs text-slate-300">Your request is with the admin — you'll get Manage back as soon as it's approved.</div>
      ) : (
        <Button data-testid="manage-request-button" size="sm" className="w-full bg-brand text-white" disabled={ask.isPending} onClick={() => ask.mutate()}>
          {ask.isPending ? "Sending…" : c.manage_active ? "Ask for another 30 days" : "Request 30 days of Manage"}
        </Button>
      )}
    </div>
  );
}
