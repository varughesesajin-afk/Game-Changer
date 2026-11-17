import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Check, LogOut, User as UserIcon, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TeamSplitDialog from "@/components/TeamSplitDialog";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import type { Community, Game, RosterEntry, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  game: Game;
  me: User | null | undefined;
  canManage: boolean;
  membersOnly: boolean;
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function Face({ r, className }: { r: RosterEntry; className?: string }) {
  if (r.picture) return <img src={r.picture} alt="" className={cn("size-full rounded-full object-cover", className)} />;
  return (
    <span className={cn("grid size-full place-items-center rounded-full text-white", r.user_id ? "bg-gradient-to-br from-ice to-energy" : "bg-gradient-to-br from-amber-400 to-orange-500", className)}>
      <UserIcon className="size-1/2" />
    </span>
  );
}

/** Numbered-spots sign-up: one circle per place. Tap a free number to join or add a name; tap a taken one to see who it is. */
export default function GameSpots({ game, me, canManage, membersOnly }: Props) {
  const nav = useNavigate();
  const [open, setOpen] = useState<number | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const bySpot = new Map(game.roster.filter((r) => r.spot).map((r) => [r.spot as number, r]));
  const total = Math.max(game.max_players, ...game.roster.map((r) => r.spot ?? 0));

  const tap = (n: number) => {
    if (!me) {
      toast("Sign in to take a spot");
      nav("/login");
      return;
    }
    if (membersOnly && !bySpot.has(n)) {
      toast("Private community — only approved members can join this game");
      return;
    }
    setOpen(n);
  };

  return (
    <div data-testid={`game-spots-${game.id}`} className="mt-3">
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const r = bySpot.get(n);
          const mine = !!r && !!me && r.user_id === me.user_id;
          return (
            <button key={n} type="button" data-testid={`spot-${game.id}-${n}`} onClick={() => tap(n)} className="flex flex-col items-center gap-1 outline-none">
              <span
                className={cn(
                  "relative grid size-14 place-items-center rounded-full font-heading text-lg font-semibold transition-transform active:scale-95",
                  r ? (r.user_id ? "ring-[2.5px] ring-energy" : "ring-[2.5px] ring-amber-400") : "border-2 border-emerald-400/60 bg-elevated/60 text-white",
                  mine && "ring-ice ring-offset-2 ring-offset-surface",
                )}
              >
                {r ? (
                  <>
                    <Face r={r} />
                    <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full border-2 border-surface bg-slate-900 text-[9px] font-bold text-white">{n}</span>
                  </>
                ) : (
                  n
                )}
              </span>
              <span className={cn("max-w-[4.5rem] truncate text-[11px] leading-none", r ? (mine ? "font-semibold text-ice" : "font-semibold text-white") : "text-slate-400")}>
                {r ? first(r.name) : "Free"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-energy" />Member</span>
        <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-amber-400" />Guest</span>
        <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full border border-emerald-300" />Free</span>
        {canManage && (
          <Button type="button" size="sm" variant="outline" data-testid={`spots-set-teams-${game.id}`} className="ml-auto h-7 text-xs" onClick={() => setTeamsOpen(true)}>
            <Users className="size-3.5" /> Set teams
          </Button>
        )}
      </div>
      {open !== null && <SpotSheet game={game} spot={open} me={me} canManage={canManage} onClose={() => setOpen(null)} />}
      {canManage && <TeamSplitDialog game={game} open={teamsOpen} onClose={() => setTeamsOpen(false)} />}
    </div>
  );
}

function SpotSheet({ game, spot, me, canManage, onClose }: { game: Game; spot: number; me: User | null | undefined; canManage: boolean; onClose: () => void }) {
  const entry = game.roster.find((r) => r.spot === spot);
  const mine = me ? game.roster.find((r) => r.user_id === me.user_id) : undefined;
  const [mode, setMode] = useState<"main" | "add" | "move">("main");
  const [kind, setKind] = useState<"guest" | "member">("guest");
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const cq = useQuery({ queryKey: ["community", game.community_id], queryFn: () => apiGet<Community>(`/communities/${game.community_id}`), enabled: canManage });
  const onGame = new Set(game.roster.map((r) => r.user_id).filter(Boolean));
  const members = (cq.isError ? [] : cq.data?.members ?? []).filter((m) => !onGame.has(m.user_id));
  const freeSpots = Array.from({ length: Math.max(game.max_players, ...game.roster.map((r) => r.spot ?? 0)) }, (_, i) => i + 1).filter((n) => !game.roster.some((r) => r.spot === n));

  const act = useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<Game>; ok: string }) => fn(),
    onSuccess: (_d, v) => { toast.success(v.ok); refreshAll(); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const run = (ok: string, fn: () => Promise<Game>) => act.mutate({ fn, ok });
  const base = `/games/${game.id}`;
  const canRemove = !!entry && !!me && (canManage || entry.added_by === me.user_id || entry.user_id === me.user_id);
  const canMove = !!entry && !!me && (canManage || entry.added_by === me.user_id || entry.user_id === me.user_id);

  const addDisabled = act.isPending || (kind === "guest" ? !name.trim() : !memberId);

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent data-testid="spot-sheet" className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-heading text-xl">
            {entry ? (
              <>
                <span className="size-9 shrink-0"><Face r={entry} /></span>
                <span className="min-w-0 truncate">Spot {spot} · {entry.name}</span>
              </>
            ) : (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-energy text-base text-energy">{spot}</span>
                Spot {spot} is free
              </>
            )}
          </DialogTitle>
          <DialogDescription>{game.community_name} · {game.date} · {game.time}</DialogDescription>
        </DialogHeader>

        {!entry && mode === "main" && (
          <div className="space-y-2">
            <button type="button" data-testid="spot-join" disabled={act.isPending} onClick={() => run(mine ? `Moved to spot ${spot}` : `You're in, spot ${spot}`, () => apiPost<Game>(`${base}/join`, { team: "A", spot }))}
              className="flex w-full items-center gap-3 rounded-2xl bg-brand px-3.5 py-3 text-left text-white shadow-md shadow-sky-700/25">
              <Check className="size-5 shrink-0" />
              <span><span className="block text-sm font-bold">{mine ? "Move here" : "Join this spot"}</span><span className="block text-xs opacity-85">{mine ? `Switch from spot ${mine.spot} to ${spot}` : `Put your own name on number ${spot}`}</span></span>
            </button>
            <button type="button" data-testid="spot-add" onClick={() => setMode("add")} className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-3.5 py-3 text-left">
              <UserPlus className="size-5 shrink-0 text-ice" />
              <span><span className="block text-sm font-bold">Add a name</span><span className="block text-xs text-slate-400">{canManage ? "For a guest or another member" : "For a friend or guest"}</span></span>
            </button>
          </div>
        )}

        {!entry && mode === "add" && (
          <div className="space-y-2.5">
            {canManage && (
              <div className="flex rounded-xl bg-elevated p-1 text-xs font-bold">
                {(["guest", "member"] as const).map((k) => (
                  <button key={k} type="button" data-testid={`spot-kind-${k}`} onClick={() => setKind(k)} className={cn("flex-1 rounded-lg py-1.5 capitalize", kind === k ? "bg-surface text-ice shadow-sm" : "text-slate-400")}>{k}</button>
                ))}
              </div>
            )}
            {kind === "guest" || !canManage ? (
              <Input data-testid="spot-guest-name" autoFocus placeholder="Type the guest's name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !addDisabled && run(`${name.trim()} added to spot ${spot}`, () => apiPost<Game>(`${base}/guests`, { name: name.trim(), spot }))} />
            ) : members.length ? (
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {members.map((m) => (
                  <button key={m.user_id} type="button" data-testid={`spot-member-${m.user_id}`} onClick={() => setMemberId(m.user_id)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border-2 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold", memberId === m.user_id ? "border-energy bg-energy/10" : "border-line")}>
                    {m.picture ? <img src={m.picture} alt="" className="size-5 rounded-full object-cover" /> : <span className="grid size-5 place-items-center rounded-full bg-energy/20 text-[9px] font-bold text-energy">{m.name[0]}</span>}
                    {first(m.name)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Every member is already on this game.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode("main")}>Back</Button>
              <Button data-testid="spot-add-confirm" className="flex-1 bg-brand text-white" disabled={addDisabled}
                onClick={() => kind === "guest" || !canManage
                  ? run(`${name.trim()} added to spot ${spot}`, () => apiPost<Game>(`${base}/guests`, { name: name.trim(), spot }))
                  : run(`Added to spot ${spot}`, () => apiPost<Game>(`${base}/guests`, { user_id: memberId, spot }))}>
                Add to spot {spot}
              </Button>
            </div>
          </div>
        )}

        {entry && mode === "main" && (
          <div className="space-y-2">
            {entry.user_id && (
              <Link to={`/players/${entry.user_id}`} onClick={onClose} className="flex items-center gap-3 rounded-2xl border-2 border-line px-3.5 py-2.5 text-sm font-bold">
                <UserIcon className="size-5 text-ice" /> View profile
              </Link>
            )}
            {entry.user_id && me && entry.user_id === me.user_id && (
              <button type="button" data-testid="spot-leave" disabled={act.isPending} onClick={() => run("You left the game", () => apiPost<Game>(`${base}/leave`))}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-3.5 py-2.5 text-left text-sm font-bold">
                <LogOut className="size-5 text-slate-400" /> Drop out of this game
              </button>
            )}
            {canMove && freeSpots.length > 0 && (
              <button type="button" data-testid="spot-move" onClick={() => setMode("move")} className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-3.5 py-2.5 text-left text-sm font-bold">
                <ArrowRightLeft className="size-5 text-ice" /> Move to another number
              </button>
            )}
            {canRemove && !(entry.user_id && me && entry.user_id === me.user_id) && (
              <button type="button" data-testid="spot-remove" disabled={act.isPending} onClick={() => run(`${entry.name} removed`, () => apiDelete<Game>(`${base}/roster/${entry.id}`))}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-red-300/60 px-3.5 py-2.5 text-left text-sm font-bold text-red-600">
                <X className="size-5" /> Remove {first(entry.name)}
              </button>
            )}
            {!canRemove && !canMove && !entry.user_id && <p className="text-xs text-slate-400">Guest added by another player.</p>}
          </div>
        )}

        {entry && mode === "move" && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-400">Pick a free number for {first(entry.name)}.</p>
            <div className="flex flex-wrap gap-2">
              {freeSpots.map((n) => (
                <button key={n} type="button" data-testid={`spot-move-to-${n}`} disabled={act.isPending}
                  onClick={() => run(`${first(entry.name)} moved to spot ${n}`, () => apiPost<Game>(`${base}/roster/${entry.id}/spot`, { spot: n }))}
                  className="grid size-10 place-items-center rounded-full border-2 border-emerald-300/70 font-heading text-sm font-semibold hover:border-energy">{n}</button>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setMode("main")}>Back</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
