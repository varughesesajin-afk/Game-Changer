import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from "@/lib/push";
import { errMsg } from "@/lib/auth";

const HELP: Partial<Record<PushState, string>> = {
  unsupported: "This browser can't show notifications. Try Chrome on Android or the installed app on iPhone.",
  "needs-install": "On iPhone, tap Share → Add to Home Screen, then open the app from your Home Screen and turn this on.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
  unavailable: "Notifications aren't switched on for this site yet.",
};

export default function NotificationToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void pushState().then(setState).catch(() => setState("unsupported")); }, []);

  const run = async (fn: () => Promise<PushState>, ok?: string) => {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
      if (ok && next === "on") toast.success(ok);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border-2 border-line bg-surface p-3 lg:col-span-2" data-testid="notifications-row">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 pl-1 text-sm font-semibold">
          {state === "on" ? <Bell className="size-4 text-energy" /> : <BellOff className="size-4 text-slate-400" />}
          Notifications
        </div>
        {state === "on" ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" data-testid="notifications-test" disabled={busy} onClick={() => void sendTestPush().then(() => toast.success("Test sent")).catch((e) => toast.error(errMsg(e)))}>Send test</Button>
            <Button size="sm" variant="outline" data-testid="notifications-off" disabled={busy} onClick={() => void run(disablePush)}>Turn off</Button>
          </div>
        ) : state === "off" ? (
          <Button size="sm" className="bg-brand text-white" data-testid="notifications-on" disabled={busy} onClick={() => void run(enablePush, "Notifications are on")}>
            {busy ? "Turning on…" : "Turn on"}
          </Button>
        ) : null}
      </div>
      <p className="pl-1 text-xs text-slate-400">
        {state === "on" || state === "off" ? "Get match reminders, fee reminders and approval updates on this phone." : state ? HELP[state] : "Checking…"}
      </p>
    </div>
  );
}
