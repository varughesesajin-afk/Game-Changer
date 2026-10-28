import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CalendarClock, MapPin, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiDelete, apiPost } from "@/lib/api";
import { errMsg, fmtDate, money, refreshAll } from "@/lib/auth";
import type { Game, TeamSide, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  game: Game;
  me: User | null | undefined;
  canManage?: boolean;
  showCommunity?: boolean;
  compact?: boolean;
}

export default function GameCard({ game, me, canManage = false, showCommunity = false, compact = false }: Props) {
  const nav = useNavigate();
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState("");
  const [guestTeam, setGuestTeam] = useState<TeamSide>("A");
  const mine = me ? game.roster.find((r) => r.user_id === me.user_id) : undefined;
  const full = game.roster.length >= game.max_players;
  const teamA = game.roster.filter((r) => r.team === "A");
  const teamB = game.roster.filter((r) => r.team === "B");

  const act = useMutation({
    mutationFn: (fn: () => Promise<Game>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  const guard = (fn: () => void) => () => {
    if (!me) {
      toast("Sign in to add your name");
      nav("/login");
      return;
    }
    fn();
  };

  const join = (team: TeamSide) =>
    act.mutate(() => apiPost<Game>(`/games/${game.id}/join`, { team }), {
      onSuccess: () => toast.success(mine ? `Switched to Team ${team}` : `You're in! Team ${team}`),
    });

  const addGuest = () => {
    if (!guest.trim()) return;
    act.mutate(() => apiPost<Game>(`/games/${game.id}/guests`, { name: guest.trim(), team: guestTeam }), {
      onSuccess: () => {
        toast.success(`${guest.trim()} added to Team ${guestTeam}`);
        setGuest("");
        setGuestOpen(false);
      },
    });
  };

  const canRemove = (addedBy: string, uid: string | null) =>
    !!me && (canManage || me.role === "admin" || addedBy === me.user_id || uid === me.user_id);

  const Column = ({ side, list }: { side: TeamSide; list: Game["roster"] }) => (
    <div className="min-w-0 flex-1 rounded-xl bg-elevated/60 p-2.5">
      <div className={cn("mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em]", side === "A" ? "text-energy" : "text-ice")}>
        Team {side} · {list.length}
      </div>
      <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }} className="space-y-1">
        {list.map((r) => (
          <motion.li
            key={r.id}
            variants={{ h: { opacity: 0, x: -4 }, s: { opacity: 1, x: 0 } }}
            data-testid={`roster-entry-${r.id}`}
            className={cn("group flex items-center justify-between gap-1 truncate text-sm", r.user_id && r.user_id === me?.user_id ? "font-bold text-white" : "text-slate-300")}
          >
            <span className="truncate">{r.name}{!r.user_id && <span className="ml-1 text-[10px] text-slate-500">guest</span>}</span>
            {canRemove(r.added_by, r.user_id) && (
              <button
                type="button"
                data-testid={`roster-remove-${r.id}`}
                aria-label={`Remove ${r.name}`}
                onClick={() => act.mutate(() => apiDelete<Game>(`/games/${game.id}/roster/${r.id}`))}
                className="text-slate-500 opacity-60 transition-opacity hover:text-red-400 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            )}
          </motion.li>
        ))}
        {list.length === 0 && <li className="text-xs text-slate-500">No one yet</li>}
      </motion.ul>
    </div>
  );

  return (
    <div data-testid={`game-card-${game.id}`} className="animate-rise rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showCommunity && (
            <Link to={`/communities/${game.community_id}`} className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ice hover:underline">
              {game.sport} · {game.community_name}
            </Link>
          )}
          <div className="font-heading text-lg font-bold text-white" data-testid="game-date">
            {fmtDate(game.date, "EEEE d MMM")}
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{game.time}</span>
            {game.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{game.venue}</span>}
            <span>{money(game.fee)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div data-testid="game-spots" className={cn("font-heading text-2xl font-bold", full ? "text-red-400" : "text-white")}>
            {game.roster.length}<span className="text-sm text-slate-500">/{game.max_players}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{full ? "Full" : "Joined"}</div>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-gradient-to-r from-energy to-amber-400 transition-[width] duration-500" style={{ width: `${Math.min(100, (game.roster.length / game.max_players) * 100)}%` }} />
      </div>

      {!compact && (
        <div className="mt-3 flex gap-2">
          <Column side="A" list={teamA} />
          <Column side="B" list={teamB} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {mine ? (
          <>
            <Button
              size="sm"
              variant="outline"
              data-testid="game-switch-team-button"
              disabled={act.isPending}
              onClick={() => join(mine.team === "A" ? "B" : "A")}
            >
              Switch to Team {mine.team === "A" ? "B" : "A"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="game-leave-button"
              disabled={act.isPending}
              onClick={() => act.mutate(() => apiPost<Game>(`/games/${game.id}/leave`), { onSuccess: () => toast("You left the game") })}
            >
              Drop out
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" data-testid="game-join-a-button" disabled={full || act.isPending} onClick={guard(() => join("A"))}>
              Join Team A
            </Button>
            <Button
              size="sm"
              data-testid="game-join-b-button"
              disabled={full || act.isPending}
              onClick={guard(() => join("B"))}
              className="bg-ice text-page hover:bg-ice/90"
            >
              Join Team B
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" data-testid="game-add-guest-toggle" disabled={full} onClick={guard(() => setGuestOpen((o) => !o))}>
          <UserPlus className="size-4" /> Add a name
        </Button>
      </div>

      {guestOpen && (
        <div className="mt-3 flex gap-2">
          <Input
            data-testid="game-guest-name-input"
            placeholder="Friend's name"
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGuest()}
          />
          <button
            type="button"
            data-testid="game-guest-team-toggle"
            onClick={() => setGuestTeam((t) => (t === "A" ? "B" : "A"))}
            className={cn("shrink-0 rounded-lg border px-3 text-xs font-bold", guestTeam === "A" ? "border-energy text-energy" : "border-ice text-ice")}
          >
            Team {guestTeam}
          </button>
          <Button size="sm" data-testid="game-guest-add-button" onClick={addGuest} disabled={act.isPending}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
