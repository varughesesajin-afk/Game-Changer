import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, CalendarPlus, Check, Trash2, Trophy, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import CreateTournamentDialog from "@/components/CreateTournamentDialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { WEEKDAYS, errMsg, fmtDate, money, refreshAll } from "@/lib/auth";
import type { Community, CommunityUpdate, Game, RemindResult, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  c: Community;
  games: Game[];
  me: User;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function ManageSheet({ c, games, me, open, onOpenChange }: Props) {
  const nav = useNavigate();
  const [f, setF] = useState<CommunityUpdate>({
    name: c.name, venue: c.venue, city: c.city, description: c.description, days: c.days, time: c.time, max_players: c.max_players, fee: c.fee,
  });
  const [gameDate, setGameDate] = useState("");
  const [tOpen, setTOpen] = useState(false);
  const set = <K extends keyof CommunityUpdate>(k: K, v: CommunityUpdate[K]) => setF((p) => ({ ...p, [k]: v }));
  const isOwner = c.owner_id === me.user_id;

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  const days = f.days ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" data-testid="manage-sheet" className="mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-3xl border-line bg-page">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl">Manage {c.name}</SheetTitle>
          <SheetDescription>
            {me.role === "admin" && !isOwner ? "Site admin access" : c.manage_until ? `Manage active until ${fmtDate(c.manage_until, "d MMM yyyy")}` : "Site admin access"}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" data-testid="manage-tab-details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="games" data-testid="manage-tab-games" className="flex-1">Games</TabsTrigger>
              <TabsTrigger value="members" data-testid="manage-tab-members" className="flex-1">Members</TabsTrigger>
              <TabsTrigger value="fees" data-testid="manage-tab-fees" className="flex-1">Fees</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" data-testid="manage-name-input" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Plays on</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        data-testid={`manage-day-${d.toLowerCase()}`}
                        onClick={() => set("days", on ? days.filter((x) => x !== d) : [...days, d])}
                        className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold transition-[background-color,color] duration-150", on ? "border-ice bg-ice text-page" : "border-line text-slate-300")}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-time">Time</Label>
                  <Input id="m-time" type="time" data-testid="manage-time-input" value={f.time ?? ""} onChange={(e) => set("time", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-max">Max players</Label>
                  <Input id="m-max" type="number" data-testid="manage-max-input" value={f.max_players ?? 0} onChange={(e) => set("max_players", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-fee">Fee (OMR)</Label>
                  <Input id="m-fee" type="number" step="0.5" data-testid="manage-fee-input" value={f.fee ?? 0} onChange={(e) => set("fee", Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-venue">Venue</Label>
                  <Input id="m-venue" data-testid="manage-venue-input" value={f.venue ?? ""} onChange={(e) => set("venue", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-city">City</Label>
                  <Input id="m-city" data-testid="manage-city-input" value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-desc">About</Label>
                <Textarea id="m-desc" data-testid="manage-description-input" value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </div>
              <Button
                data-testid="manage-save-details"
                className="w-full"
                disabled={act.isPending || (f.name ?? "").trim().length < 2}
                onClick={() => act.mutate(() => apiPatch(`/communities/${c.id}`, f), { onSuccess: () => toast.success("Community updated") })}
              >
                Save changes
              </Button>
              <div className="flex gap-2 pt-2">
                {isOwner && c.manage_active && (
                  <Button
                    variant="ghost"
                    data-testid="manage-cancel-subscription"
                    className="flex-1 text-slate-400"
                    onClick={() => {
                      if (window.confirm("Cancel the Manage subscription? Manage tools lock immediately."))
                        act.mutate(() => apiPost(`/billing/communities/${c.id}/cancel`), { onSuccess: () => { toast("Manage cancelled"); onOpenChange(false); } });
                    }}
                  >
                    Cancel subscription
                  </Button>
                )}
                <Button
                  variant="ghost"
                  data-testid="manage-delete-community"
                  className="flex-1 text-red-400"
                  onClick={() => {
                    if (window.confirm("Delete this community and all its games?"))
                      act.mutate(() => apiDelete(`/communities/${c.id}`), { onSuccess: () => nav("/communities") });
                  }}
                >
                  <Trash2 className="size-4" /> Delete community
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="games" className="space-y-4 pt-4">
              <Button
                data-testid="manage-schedule-week"
                className="w-full"
                disabled={act.isPending}
                onClick={() => act.mutate(() => apiPost(`/communities/${c.id}/schedule-week`), { onSuccess: () => toast.success("Next week's games scheduled") })}
              >
                <CalendarPlus className="size-4" /> Schedule next week ({c.days.join(" & ") || "no days set"})
              </Button>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="m-date">Add a one-off game</Label>
                  <Input id="m-date" type="date" data-testid="manage-game-date-input" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
                </div>
                <Button
                  variant="outline"
                  data-testid="manage-add-game"
                  disabled={!gameDate || act.isPending}
                  onClick={() => act.mutate(() => apiPost(`/communities/${c.id}/games`, { date: gameDate }), { onSuccess: () => { toast.success("Game added"); setGameDate(""); } })}
                >
                  Add
                </Button>
              </div>
              <Button variant="outline" data-testid="manage-host-tournament" className="w-full" onClick={() => setTOpen(true)}>
                <Trophy className="size-4" /> Host a tournament
              </Button>
              <div className="space-y-2">
                {games.map((g) => (
                  <div key={g.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                    <span>{fmtDate(g.date, "EEE d MMM")} · {g.time}</span>
                    <span className="text-slate-400">{g.roster.length}/{g.max_players}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-2 pt-4">
              {c.members.map((m) => (
                <div key={m.user_id} data-testid={`manage-member-${m.user_id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
                  <span className="text-sm">{m.name}{m.user_id === c.owner_id && <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-energy">Organiser</span>}</span>
                  {m.user_id !== c.owner_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`manage-remove-member-${m.user_id}`}
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name} from the community and upcoming games?`))
                          act.mutate(() => apiDelete(`/communities/${c.id}/members/${m.user_id}`), { onSuccess: () => toast(`${m.name} removed`) });
                      }}
                    >
                      <UserMinus className="size-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="pt-1 text-xs text-slate-500">To remove a single name from a game, tap the × beside it on the game card.</p>
            </TabsContent>

            <TabsContent value="fees" className="space-y-4 pt-4">
              {games.length === 0 && <p className="text-sm text-slate-400">No upcoming games.</p>}
              {games.map((g) => {
                const paid = g.roster.filter((r) => r.paid).length;
                return (
                  <div key={g.id} data-testid={`fees-game-${g.id}`} className="rounded-2xl border border-line bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-heading font-bold">{fmtDate(g.date, "EEE d MMM")}</span>
                      {g.roster.length - paid > 0 && (
                        <Button
                          size="xs"
                          variant="outline"
                          data-testid={`fees-remind-${g.id}`}
                          disabled={act.isPending}
                          onClick={() =>
                            act.mutate(() => apiPost<RemindResult>(`/games/${g.id}/remind-unpaid`), {
                              onSuccess: (res) => {
                                const r = res as RemindResult;
                                toast.success(`Reminder sent to ${r.reminded} player${r.reminded === 1 ? "" : "s"}` + (r.skipped_guests ? ` · ${r.skipped_guests} guest name${r.skipped_guests === 1 ? "" : "s"} skipped` : ""));
                              },
                            })
                          }
                        >
                          <BellRing className="size-3.5" /> Remind unpaid
                        </Button>
                      )}
                    </div>
                    <div className="mb-2 flex justify-end">
                      <span className="text-xs text-slate-400">
                        <span className="font-semibold text-energy">OMR {paid * g.fee}</span> collected · OMR {(g.roster.length - paid) * g.fee} due
                      </span>
                    </div>
                    <div className="space-y-1">
                      {g.roster.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          data-testid={`fees-toggle-${r.id}`}
                          onClick={() => act.mutate(() => apiPost(`/games/${g.id}/roster/${r.id}/paid`, { paid: !r.paid }))}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-[background-color] duration-150",
                            r.paid ? "bg-energy/15 text-white" : "bg-elevated/60 text-slate-300 hover:bg-elevated",
                          )}
                        >
                          <span>{r.name}</span>
                          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", r.paid ? "text-energy" : "text-slate-500")}>
                            {r.paid ? <><Check className="size-3.5" /> Paid</> : "Unpaid"}
                          </span>
                        </button>
                      ))}
                      {g.roster.length === 0 && <p className="text-xs text-slate-500">No names yet.</p>}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
        <CreateTournamentDialog open={tOpen} onOpenChange={setTOpen} kind="community" presetCommunity={c} />
      </SheetContent>
    </Sheet>
  );
}
