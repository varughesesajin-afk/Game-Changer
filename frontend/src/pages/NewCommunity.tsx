import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SportPills from "@/components/SportPills";
import CoverPhotoPicker from "@/components/CoverPhotoPicker";
import { apiGet, apiPost } from "@/lib/api";
import { WEEKDAYS, errMsg, refreshAll, useMe } from "@/lib/auth";
import type { Community, CommunityCreate } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: CommunityCreate = {
  name: "", sport: "Football", city: "Muscat", venue: "", description: "", days: ["Sun", "Tue"], time: "20:00", max_players: 14, fee: 0,
};

export default function NewCommunity() {
  const nav = useNavigate();
  const { data: me, isLoading } = useMe();
  const [f, setF] = useState<CommunityCreate>(EMPTY);
  const set = <K extends keyof CommunityCreate>(k: K, v: CommunityCreate[K]) => setF((p) => ({ ...p, [k]: v }));
  const mine = useQuery({ queryKey: ["communities", "mine"], queryFn: () => apiGet<Community[]>("/communities?mine=true"), enabled: !!me });
  const hostsAlready = !!me && me.role !== "admin" && (mine.data ?? []).some((c) => c.owner_id === me.user_id);

  const create = useMutation({
    mutationFn: () => apiPost<Community>("/communities", { ...f, pay_manage: hostsAlready }),
    onSuccess: (c) => {
      toast.success(hostsAlready ? "Paid OMR 1 — community created with Manage active" : "Community created — first games scheduled");
      refreshAll();
      nav(`/communities/${c.id}`, { replace: true });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!isLoading && !me) return <Navigate to="/login" replace />;

  return (
    <div className="space-y-6 px-5 pb-8 pt-5" data-testid="new-community-page">
      <div className="flex items-center gap-3">
        <button type="button" data-testid="back-button" onClick={() => nav(-1)} aria-label="Back" className="rounded-full bg-surface p-2 transition-colors hover:bg-elevated">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ice">New community</div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Start a community</h1>
        </div>
      </div>
      <p className="text-sm text-slate-400">Your regular group — we'll set up the weekly games so players can add their names. You'll be its host.</p>

      {hostsAlready && (
        <div data-testid="extra-community-notice" className="rounded-2xl border border-energy/40 bg-gradient-to-r from-ice/10 to-energy/10 p-4 text-sm">
          <span className="font-semibold text-energy">You already host a community.</span> Each additional community costs{" "}
          <span className="font-semibold text-white">OMR 1/month</span> and comes with Manage switched on. Test mode — no card is charged.
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cc-name">Community name</Label>
        <Input id="cc-name" data-testid="community-name-input" placeholder="Sunday Ballers" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Cover photo</Label>
        <CoverPhotoPicker sport={f.sport} value={f.image} onChange={(url) => set("image", url || null)} testid="community-cover" />
      </div>

      <div className="space-y-2">
        <Label>Sport</Label>
        <SportPills value={f.sport} onChange={(s) => set("sport", s)} includeAll={false} wrap testPrefix="community-sport" />
      </div>

      <div className="space-y-2">
        <Label>Plays on</Label>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = f.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                data-testid={`community-day-${d.toLowerCase()}`}
                onClick={() => set("days", on ? f.days.filter((x) => x !== d) : [...f.days, d])}
                className={cn(
                  "rounded-lg border py-2 text-xs font-semibold transition-[background-color,color] duration-150",
                  on ? "border-ice bg-ice text-page" : "border-line text-slate-300",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cc-time">Start time</Label>
        <Input id="cc-time" type="time" data-testid="community-time-input" value={f.time} onChange={(e) => set("time", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-max">Max players per game</Label>
        <Input id="cc-max" type="number" inputMode="numeric" data-testid="community-max-input" value={f.max_players} onChange={(e) => set("max_players", Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-fee">Match fee per player (OMR)</Label>
        <Input id="cc-fee" type="number" step="0.5" inputMode="decimal" data-testid="community-fee-input" value={f.fee} onChange={(e) => set("fee", Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-venue">Venue</Label>
        <Input id="cc-venue" data-testid="community-venue-input" placeholder="Al Khuwair Turf" value={f.venue} onChange={(e) => set("venue", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-city">City</Label>
        <Input id="cc-city" data-testid="community-city-input" value={f.city} onChange={(e) => set("city", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-desc">About</Label>
        <Textarea id="cc-desc" rows={4} data-testid="community-description-input" placeholder="Friendly 7-a-side, all levels welcome" value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <Button
        size="lg"
        data-testid="community-create-submit"
        disabled={f.name.trim().length < 2 || create.isPending || (!!me && mine.isLoading)}
        onClick={() => create.mutate()}
        className="h-12 w-full bg-brand text-base text-white"
      >
        {hostsAlready && <CreditCard className="size-4" />}
        {create.isPending ? "Creating…" : hostsAlready ? "Pay OMR 1 & create community" : "Create community"}
      </Button>
    </div>
  );
}
