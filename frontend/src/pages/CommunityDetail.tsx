import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, CalendarPlus, Crown, MapPin, Trash2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import GameCard from "@/components/GameCard";
import TournamentCard from "@/components/TournamentCard";
import CreateTournamentDialog from "@/components/CreateTournamentDialog";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg, money, refreshAll, sportImage, useMe } from "@/lib/auth";
import type { Community, Game, Tournament } from "@/lib/types";

export default function CommunityDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const [tOpen, setTOpen] = useState(false);
  const cq = useQuery({ queryKey: ["community", id], queryFn: () => apiGet<Community>(`/communities/${id}`) });
  const gq = useQuery({ queryKey: ["games", id], queryFn: () => apiGet<Game[]>(`/communities/${id}/games`) });
  const tq = useQuery({ queryKey: ["tournaments", "community", id], queryFn: () => apiGet<Tournament[]>(`/tournaments?community_id=${id}`) });
  const c = cq.isError ? undefined : cq.data;
  const isOwner = !!me && !!c && (c.owner_id === me.user_id || me.role === "admin");
  const isMember = !!me && !!c && c.members.some((m) => m.user_id === me.user_id);

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  const needLogin = () => {
    toast("Sign in first");
    nav("/login");
  };

  return (
    <div>
      <header className="relative h-56 overflow-hidden">
        <img src={sportImage(c?.sport ?? "", c?.image)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(11,15,23,0.3) 0%, rgba(11,15,23,0.9) 80%, #0B0F17 100%)" }} />
        <button
          type="button"
          data-testid="back-button"
          onClick={() => nav(-1)}
          className="absolute left-4 top-4 rounded-full bg-black/40 p-2 backdrop-blur transition-colors hover:bg-black/60"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="absolute bottom-4 left-5 right-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ice">{c?.sport ?? "Community"}</div>
          <h1 data-testid="community-title" className="font-heading text-3xl font-bold leading-tight tracking-tight">{c?.name ?? "Loading…"}</h1>
        </div>
      </header>

      {c && (
        <div className="space-y-6 px-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: CalendarClock, label: "Plays", value: `${c.days.join(" & ") || "Ad-hoc"}` },
              { icon: Users, label: "Members", value: String(c.members.length) },
              { icon: Trophy, label: "Per game", value: money(c.fee) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-line bg-surface p-3">
                <Icon className="mx-auto size-4 text-energy" />
                <div className="mt-1 truncate font-heading text-sm font-bold">{value}</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm text-slate-300">
            <p>{c.description}</p>
            <p className="flex items-center gap-1 text-slate-400"><MapPin className="size-4" />{c.venue || "Venue TBA"}{c.city ? `, ${c.city}` : ""} · {c.time}</p>
            <p className="flex items-center gap-1 text-slate-400"><Crown className="size-4 text-amber-400" />Organised by {c.owner_name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isMember ? (
              <Button data-testid="community-join-button" onClick={() => (me ? act.mutate(() => apiPost(`/communities/${id}/join`), { onSuccess: () => toast.success("Welcome to the group!") }) : needLogin())}>
                Join community
              </Button>
            ) : c.owner_id !== me?.user_id ? (
              <Button variant="outline" data-testid="community-leave-button" onClick={() => act.mutate(() => apiPost(`/communities/${id}/leave`))}>
                Leave group
              </Button>
            ) : null}
            {isOwner && (
              <>
                <Button
                  variant="outline"
                  data-testid="community-schedule-week-button"
                  onClick={() => act.mutate(() => apiPost(`/communities/${id}/schedule-week`), { onSuccess: () => toast.success("Next week's games scheduled") })}
                >
                  <CalendarPlus className="size-4" /> Schedule next week
                </Button>
                <Button variant="outline" data-testid="community-host-tournament-button" onClick={() => setTOpen(true)}>
                  <Trophy className="size-4" /> Host tournament
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="community-delete-button"
                  aria-label="Delete community"
                  onClick={() => {
                    if (window.confirm("Delete this community and its games?"))
                      act.mutate(() => apiDelete(`/communities/${id}`), { onSuccess: () => nav("/communities") });
                  }}
                >
                  <Trash2 className="size-4 text-red-400" />
                </Button>
              </>
            )}
          </div>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold">Upcoming games</h2>
            {!gq.isError && gq.data?.length ? (
              gq.data.map((g) => <GameCard key={g.id} game={g} me={me} canManage={isOwner} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No upcoming games scheduled.</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold">Group tournaments</h2>
            {!tq.isError && tq.data?.length ? (
              tq.data.map((t) => <TournamentCard key={t.id} t={t} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No tournaments in this group yet.</div>
            )}
          </section>

          <section className="space-y-3 pb-4">
            <h2 className="font-heading text-xl font-bold">Members</h2>
            <div className="flex flex-wrap gap-2" data-testid="community-members">
              {c.members.map((m) => (
                <span key={m.user_id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
                  <span className="grid size-5 place-items-center rounded-full bg-energy/20 text-[10px] font-bold text-energy">{m.name[0]}</span>
                  {m.name}
                </span>
              ))}
            </div>
          </section>
          {isOwner && <CreateTournamentDialog open={tOpen} onOpenChange={setTOpen} kind="community" presetCommunity={c} />}
        </div>
      )}
      {cq.isError && <div className="p-5 text-sm text-slate-400">Couldn't load this community.</div>}
    </div>
  );
}
