import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BadgeCheck, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import ManageSubscribeDialog, { MANAGE_PERKS } from "@/components/ManageSubscribeDialog";
import { apiGet } from "@/lib/api";
import { fmtDate, useMe } from "@/lib/auth";
import type { Community, PaymentRecord } from "@/lib/types";

function Slider({ label, value, min, max, step = 1, onChange, suffix, testid }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix: string; testid: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{value} {suffix}</span>
      </div>
      <input type="range" data-testid={testid} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#10B981]" />
    </div>
  );
}

export default function HostPro() {
  const nav = useNavigate();
  const { data: me } = useMe();
  const [players, setPlayers] = useState(14);
  const [fee, setFee] = useState(2);
  const [games, setGames] = useState(2);
  const [subFor, setSubFor] = useState<Community | null>(null);
  const mine = useQuery({ queryKey: ["communities", "mine"], queryFn: () => apiGet<Community[]>("/communities?mine=true"), enabled: !!me });
  const history = useQuery({ queryKey: ["billing-history"], queryFn: () => apiGet<PaymentRecord[]>("/billing/history"), enabled: !!me });
  const owned = (mine.data ?? []).filter((c) => c.owner_id === me?.user_id);
  const monthly = players * fee * games * 4;

  return (
    <div data-testid="host-pro-paywall" className="space-y-6 px-5 pt-6">
      <div>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-energy">
          <Sparkles className="size-3.5" /> Host & Earn
        </div>
        <h1 className="mt-1 font-heading text-3xl font-bold leading-tight tracking-tight">Turn your weekly game into a real club.</h1>
        <p className="mt-2 text-sm text-slate-400">Each community has one host. Every community starts with a 15-day free trial (no tournaments or photo uploads). After that — or any time before — pay OMR 1 every 30 days per community to keep managing it and unlock tournaments and photos.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ice">Earnings calculator</div>
        <div>
          <div data-testid="revenue-projection" className="font-heading text-5xl font-bold tracking-tight text-brand">OMR {monthly.toFixed(0)}</div>
          <div className="text-sm text-slate-400">collected per month from match fees</div>
        </div>
        <Slider label="Players per game" value={players} min={4} max={30} onChange={setPlayers} suffix="" testid="calc-players-slider" />
        <Slider label="Fee per player" value={fee} min={0} max={10} step={0.5} onChange={setFee} suffix="OMR" testid="calc-fee-slider" />
        <Slider label="Games per week" value={games} min={1} max={7} onChange={setGames} suffix="" testid="calc-games-slider" />
      </div>

      <motion.div whileTap={{ scale: 0.99 }} data-testid="plan-card-community_manage" className="rounded-2xl border border-energy/50 bg-gradient-to-br from-ice/15 via-surface to-energy/15 p-5">
        <div className="font-heading text-lg font-bold">Community Manage</div>
        <div className="mt-1">
          <span className="font-heading text-3xl font-bold">OMR 1</span>
          <span className="text-sm text-slate-400"> / 30 days per community</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
          {MANAGE_PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2"><BadgeCheck className="size-4 text-energy" />{p}</li>
          ))}
        </ul>
        <div className="mt-4 space-y-2">
          {!me ? (
            <Button data-testid="plan-signin-button" className="w-full bg-brand text-white" onClick={() => { toast("Sign in first"); nav("/login"); }}>Sign in to get started</Button>
          ) : owned.length === 0 ? (
            <Link to="/communities/new" data-testid="plan-start-community-link" className={buttonVariants({ className: "w-full bg-brand text-white" })}>Start your community first</Link>
          ) : (
            owned.map((c) => (
              <div key={c.id} data-testid={`plan-community-${c.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-page/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.premium_active ? `Paid until ${fmtDate(c.manage_until ?? "", "d MMM")}` : c.in_trial ? `Free trial until ${fmtDate(c.trial_until ?? "", "d MMM")}` : "Locked — not paid"}</div>
                </div>
                <Button size="sm" data-testid={`plan-activate-${c.id}`} className="bg-brand text-white" onClick={() => setSubFor(c)}>{c.premium_active ? "Renew" : "Pay OMR 1"}</Button>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {me && history.data && history.data.length > 0 && (
        <div className="space-y-2 pb-4">
          <h2 className="font-heading text-lg font-bold">Billing history</h2>
          {history.data.map((h) => (
            <div key={h.id} data-testid={`billing-row-${h.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2 text-sm">
              <span className="truncate text-slate-300">{fmtDate(h.created_at, "d MMM yyyy")} · {h.community_name ?? "Manage"}</span>
              <span className="font-semibold">{h.currency} {h.amount}</span>
            </div>
          ))}
        </div>
      )}
      <ManageSubscribeDialog community={subFor} onOpenChange={(o) => !o && setSubFor(null)} />
    </div>
  );
}
