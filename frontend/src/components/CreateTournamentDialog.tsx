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
import { FORMATS } from "@/lib/formats";
import { cn } from "@/lib/utils";
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
    format: "knockout", league_legs: 1, group_count: 2, advance_per_group: 2, playoff_teams: 4, format_notes: "",
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
      if (e instanceof ApiError && e.status === 402) toast.error(errMsg(e), { action: { label: "Manage plan", onClick: () => nav("/monetize") } });
      else toast.error(errMsg(e));
    },
  });

  const valid = f.title.trim().length >= 2 && !!f.start_date && (kind === "official" || !!f.community_id) && (f.format !== "other" || f.format_notes.trim().length >= 10);
  const roundRobin = f.format === "league" || f.format === "groups_knockout" || f.format === "league_playoffs";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-tournament-dialog" className="max-h-[90dvh] max-w-md overflow-x-hidden overflow-y-auto overscroll-contain">
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
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="space-y-1.5">
              {FORMATS.map((fm) => (
                <button
                  key={fm.id}
                  type="button"
                  data-testid={`tournament-format-${fm.id}`}
                  onClick={() => set("format", fm.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-[border-color,background-color] duration-150",
                    f.format === fm.id ? "border-energy bg-energy/10" : "border-line bg-surface hover:border-slate-500",
                  )}
                >
                  <div className="text-sm font-semibold">{fm.label}</div>
                  <div className="text-xs text-slate-400">{fm.desc}</div>
                </button>
              ))}
            </div>
            {roundRobin && (
              <div className="grid grid-cols-2 gap-1.5">
                {[1, 2].map((legs) => (
                  <button key={legs} type="button" data-testid={`tournament-legs-${legs}`} onClick={() => set("league_legs", legs)}
                    className={cn("rounded-lg border py-1.5 text-xs font-semibold", f.league_legs === legs ? "border-transparent bg-brand text-white" : "border-line text-slate-300")}>
                    {legs === 1 ? "Play each team once" : "Home & away"}
                  </button>
                ))}
              </div>
            )}
            {f.format === "groups_knockout" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ct-groups">Groups</Label>
                  <Input id="ct-groups" type="number" min={1} data-testid="tournament-group-count-input" value={f.group_count} onChange={(e) => set("group_count", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ct-adv">Advance per group</Label>
                  <Input id="ct-adv" type="number" min={1} data-testid="tournament-advance-input" value={f.advance_per_group} onChange={(e) => set("advance_per_group", Number(e.target.value))} />
                </div>
              </div>
            )}
            {f.format === "league_playoffs" && (
              <div className="space-y-1.5">
                <Label htmlFor="ct-po">Teams into the playoffs</Label>
                <Input id="ct-po" type="number" min={2} data-testid="tournament-playoff-input" value={f.playoff_teams} onChange={(e) => set("playoff_teams", Number(e.target.value))} />
              </div>
            )}
            {f.format === "other" && (
              <div className="space-y-1.5">
                <Label htmlFor="ct-notes">Explain your format</Label>
                <Textarea id="ct-notes" data-testid="tournament-format-notes-input" placeholder="e.g. Swiss system, 5 rounds, top 2 play a final" value={f.format_notes} onChange={(e) => set("format_notes", e.target.value)} />
                <p className="text-xs text-slate-500">The app admin reviews custom formats and will try to make them available.</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Sport</Label>
            <SportPills value={f.sport} onChange={(s) => set("sport", s)} includeAll={false} wrap testPrefix="tournament-sport" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="min-w-0 space-y-1.5">
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
