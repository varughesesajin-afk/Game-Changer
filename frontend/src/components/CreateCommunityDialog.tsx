import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SportPills from "@/components/SportPills";
import { apiPost } from "@/lib/api";
import { WEEKDAYS, errMsg, refreshAll } from "@/lib/auth";
import type { Community, CommunityCreate } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: CommunityCreate = {
  name: "", sport: "Football", city: "Muscat", venue: "", description: "", days: ["Sun", "Tue"], time: "20:00", max_players: 14, fee: 0,
};

export default function CreateCommunityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate();
  const [f, setF] = useState<CommunityCreate>(EMPTY);
  const set = <K extends keyof CommunityCreate>(k: K, v: CommunityCreate[K]) => setF((p) => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: () => apiPost<Community>("/communities", f),
    onSuccess: (c) => {
      toast.success("Community created — first games scheduled");
      refreshAll();
      onOpenChange(false);
      setF(EMPTY);
      nav(`/communities/${c.id}`);
    },
    onError: (e) => {
      toast.error(errMsg(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-community-dialog" className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Start a community</DialogTitle>
          <DialogDescription>Your regular group — we'll set up the weekly games so players can add their names.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Group name</Label>
            <Input id="cc-name" data-testid="community-name-input" placeholder="Sunday Ballers" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sport</Label>
            <SportPills value={f.sport} onChange={(s) => set("sport", s)} includeAll={false} testPrefix="community-sport" />
          </div>
          <div className="space-y-1.5">
            <Label>Plays on</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = f.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    data-testid={`community-day-${d.toLowerCase()}`}
                    onClick={() => set("days", on ? f.days.filter((x) => x !== d) : [...f.days, d])}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-[background-color,color] duration-150",
                      on ? "border-ice bg-ice text-page" : "border-line text-slate-300",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-time">Time</Label>
              <Input id="cc-time" type="time" data-testid="community-time-input" value={f.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-max">Max players</Label>
              <Input id="cc-max" type="number" data-testid="community-max-input" value={f.max_players} onChange={(e) => set("max_players", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-fee">Fee (OMR)</Label>
              <Input id="cc-fee" type="number" step="0.5" data-testid="community-fee-input" value={f.fee} onChange={(e) => set("fee", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-venue">Venue</Label>
              <Input id="cc-venue" data-testid="community-venue-input" value={f.venue} onChange={(e) => set("venue", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-city">City</Label>
              <Input id="cc-city" data-testid="community-city-input" value={f.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-desc">About</Label>
            <Textarea id="cc-desc" data-testid="community-description-input" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="community-create-submit" disabled={f.name.trim().length < 2 || create.isPending} onClick={() => create.mutate()} className="w-full">
            {create.isPending ? "Creating…" : "Create community"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
