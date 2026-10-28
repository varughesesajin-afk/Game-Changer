import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BadgeCheck, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll, useMe } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { PaymentRecord, Plan, User } from "@/lib/types";
import { cn } from "@/lib/utils";

function Slider({ label, value, min, max, step = 1, onChange, suffix, testid }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix: string; testid: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{value} {suffix}</span>
      </div>
      <input
        type="range"
        data-testid={testid}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#FF5722]"
      />
    </div>
  );
}

export default function HostPro() {
  const nav = useNavigate();
  const { data: me } = useMe();
  const [players, setPlayers] = useState(14);
  const [fee, setFee] = useState(2);
  const [games, setGames] = useState(2);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => apiGet<Plan[]>("/billing/plans") });
  const history = useQuery({ queryKey: ["billing-history"], queryFn: () => apiGet<PaymentRecord[]>("/billing/history"), enabled: !!me });
  const monthly = players * fee * games * 4;

  const subscribe = useMutation({
    mutationFn: (plan_id: string) => apiPost<User>("/billing/subscribe", { plan_id }),
    onSuccess: (u) => {
      queryClient.setQueryData(["me"], u);
      toast.success("You're Organiser Pro! Go build your league.");
      setChosen(null);
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const cancel = useMutation({
    mutationFn: () => apiPost<User>("/billing/cancel"),
    onSuccess: (u) => {
      queryClient.setQueryData(["me"], u);
      toast("Subscription cancelled");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pick = (p: Plan) => {
    if (!me) {
      toast("Sign in to subscribe");
      nav("/login");
      return;
    }
    setChosen(p);
  };

  return (
    <div data-testid="host-pro-paywall" className="space-y-6 px-5 pt-6">
      <div>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-energy">
          <Sparkles className="size-3.5" /> Host & Earn
        </div>
        <h1 className="mt-1 font-heading text-3xl font-bold leading-tight tracking-tight">Turn your weekly game into a real club.</h1>
        <p className="mt-2 text-sm text-slate-400">Players add their names, you collect the match fees and run tournaments with live brackets.</p>
      </div>

      {me?.is_pro && (
        <div data-testid="pro-status-card" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-3">
            <BadgeCheck className="size-7 text-emerald-400" />
            <div>
              <div className="font-heading text-lg font-bold">Organiser Pro active</div>
              <div className="text-xs text-slate-300">Renews {me.pro_until ? fmtDate(me.pro_until, "d MMM yyyy") : "—"}</div>
            </div>
          </div>
          <Button size="sm" variant="ghost" data-testid="pro-cancel-button" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel
          </Button>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ice">Earnings calculator</div>
        <div>
          <div data-testid="revenue-projection" className="font-heading text-5xl font-bold tracking-tight text-white">
            OMR {monthly.toFixed(0)}
          </div>
          <div className="text-sm text-slate-400">collected per month from match fees</div>
        </div>
        <Slider label="Players per game" value={players} min={4} max={30} onChange={setPlayers} suffix="" testid="calc-players-slider" />
        <Slider label="Fee per player" value={fee} min={0} max={10} step={0.5} onChange={setFee} suffix="OMR" testid="calc-fee-slider" />
        <Slider label="Games per week" value={games} min={1} max={7} onChange={setGames} suffix="" testid="calc-games-slider" />
      </div>

      <div className="space-y-3">
        {(plans.isError ? [] : plans.data ?? []).map((p) => {
          const yearly = p.interval === "year";
          const current = me?.is_pro && me.pro_plan === p.id;
          return (
            <motion.div
              key={p.id}
              whileTap={{ scale: 0.98 }}
              data-testid={`plan-card-${p.id}`}
              className={cn("relative rounded-2xl border p-5", yearly ? "border-energy bg-gradient-to-br from-energy/15 to-surface" : "border-line bg-surface")}
            >
              {yearly && <span className="absolute right-4 top-4 rounded-full bg-energy px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]">2 months free</span>}
              <div className="font-heading text-lg font-bold">{p.name}</div>
              <div className="mt-1">
                <span className="font-heading text-3xl font-bold">{p.currency} {p.price}</span>
                <span className="text-sm text-slate-400"> / {p.interval}</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2"><BadgeCheck className="size-4 text-ice" />{perk}</li>
                ))}
              </ul>
              <Button
                data-testid={`subscribe-${p.id}`}
                className={cn("mt-4 w-full", !yearly && "bg-ice text-page hover:bg-ice/90")}
                disabled={!!current}
                onClick={() => pick(p)}
              >
                {current ? "Current plan" : me?.is_pro ? "Switch / extend" : "Go Pro"}
              </Button>
            </motion.div>
          );
        })}
        <p className="text-center text-xs text-slate-500">Free plan: join unlimited games & 1 community you organise.</p>
      </div>

      {me && history.data && history.data.length > 0 && (
        <div className="space-y-2 pb-4">
          <h2 className="font-heading text-lg font-bold">Billing history</h2>
          {history.data.map((h) => (
            <div key={h.id} data-testid={`billing-row-${h.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2 text-sm">
              <span className="text-slate-300">{fmtDate(h.created_at, "d MMM yyyy")} · {h.plan_id === "pro_yearly" ? "Yearly" : "Monthly"}</span>
              <span className="font-semibold">{h.currency} {h.amount}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!chosen} onOpenChange={(o: boolean) => !o && setChosen(null)}>
        <DialogContent data-testid="checkout-dialog" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirm subscription</DialogTitle>
            <DialogDescription>
              Test mode — payments are simulated, no card is charged. Real payments will be switched on later.
            </DialogDescription>
          </DialogHeader>
          {chosen && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-elevated p-4">
              <div>
                <div className="font-semibold">{chosen.name}</div>
                <div className="text-xs text-slate-400">Billed every {chosen.interval}</div>
              </div>
              <div className="font-heading text-2xl font-bold">{chosen.currency} {chosen.price}</div>
            </div>
          )}
          <DialogFooter>
            <Button data-testid="checkout-confirm-button" className="w-full" disabled={subscribe.isPending} onClick={() => chosen && subscribe.mutate(chosen.id)}>
              <CreditCard className="size-4" /> {subscribe.isPending ? "Processing…" : "Pay & activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
