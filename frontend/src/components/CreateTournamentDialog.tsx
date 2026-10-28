import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import SportPills from "@/components/SportPills";
import { ApiError, apiPost } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import type { Community, Tournament, TournamentCreate, TournamentKind } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: TournamentKind;
  communities?: Community[];
  presetCommunity?: Community;
}

export default function CreateTournamentDialog({ open, onOpenChange, kind, communities = [], presetCommunity }: Props) {
  const nav = useNavigate();
  const init = (): TournamentCreate => ({
    title: "", sport: presetCommunity?.sport ?? "Football", kind, community_id: presetCommunity?.id ?? communities[0]?.id ?? null,
    venue: presetCommunity?.venue ?? "", city: presetCommunity?.city ?? "Muscat", start_date: "", entry_fee: 0, prize_pool: 0,
    max_teams: 8, team_size: 5, description: "",
  });
  const [f, setF] = useState<TournamentCreate>(init);
  const set = <K extends keyof TournamentCreate>(k: K, v: TournamentCreate[K]) => setF((p) => ({ ...p, [k]: v }));
  const communityLabel = (id: unknown) => communities.find((c) => c.id === id)?.name ?? "Select community";

  const create = useMutation({
    mutationFn: () => apiPost<Tournament>("/tournaments", { ...f, kind }),
    onSuccess: (t) => {
      toast.success("Tournament created — registrations are open");
      refreshAll();
      onOpenChange(false);
      setF(init());
      nav(`/tournaments/${t.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) toast.error(errMsg(e), { action: { label: "Go Pro", onClick: () => nav("/monetize") } });
      else toast.error(errMsg(e));
    },
  });

  const valid = f.title.trim().length >= 2 && !!f.start_date && (kind === "official" || !!f.community_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-tournament-dialog" className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{kind === "official" ? "New official tournament" : "Host a community tournament"}</DialogTitle>
          <DialogDescription>Knockout format — teams register, then you draw the bracket and report scores.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ct-title">Title</Label>
            <Input id="ct-title" data-testid="tournament-title-input" placeholder="Summer Cup" value={f.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          {kind === "community" && !presetCommunity && (
            <div className="space-y-1.5">
              <Label>Community</Label>
              {communities.length ? (
                <Select value={f.community_id ?? ""} onValueChange={(v: string) => set("community_id", v)}>
                  <SelectTrigger data-testid="tournament-community-select" className="w-full">
                    <SelectValue>{(v) => communityLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {communities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-400">Create a community first — tournaments are hosted inside your group.</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Sport</Label>
            <SportPills value={f.sport} onChange={(s) => set("sport", s)} includeAll={false} testPrefix="tournament-sport" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-date">Start date</Label>
              <Input id="ct-date" type="date" data-testid="tournament-date-input" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-venue">Venue</Label>
              <Input id="ct-venue" data-testid="tournament-venue-input" value={f.venue} onChange={(e) => set("venue", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-fee">Entry fee / team</Label>
              <Input id="ct-fee" type="number" data-testid="tournament-fee-input" value={f.entry_fee} onChange={(e) => set("entry_fee", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-prize">Prize pool</Label>
              <Input id="ct-prize" type="number" data-testid="tournament-prize-input" value={f.prize_pool} onChange={(e) => set("prize_pool", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-max">Max teams</Label>
              <Input id="ct-max" type="number" data-testid="tournament-max-teams-input" value={f.max_teams} onChange={(e) => set("max_teams", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-size">Players / team</Label>
              <Input id="ct-size" type="number" data-testid="tournament-team-size-input" value={f.team_size} onChange={(e) => set("team_size", Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-desc">Rules & details</Label>
            <Textarea id="ct-desc" data-testid="tournament-description-input" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="tournament-create-submit" className="w-full" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create tournament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
