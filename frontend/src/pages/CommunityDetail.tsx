import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Crown, Lock, MapPin, Settings2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import GameCard from "@/components/GameCard";
import TournamentCard from "@/components/TournamentCard";
import ManageSheet from "@/components/ManageSheet";
import Leaderboard from "@/components/Leaderboard";
import Gallery from "@/components/Gallery";
import Avatar from "@/components/Avatar";
import ShareButtons from "@/components/ShareButtons";
import ManageSubscribeDialog from "@/components/ManageSubscribeDialog";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, money, refreshAll, sportImage, useMe } from "@/lib/auth";
import type { Community, Game, Tournament } from "@/lib/types";

export default function CommunityDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const [manageOpen, setManageOpen] = useState(false);
  const [subFor, setSubFor] = useState<Community | null>(null);
  const cq = useQuery({ queryKey: ["community", id], queryFn: () => apiGet<Community>(`/communities/${id}`) });
  const gq = useQuery({ queryKey: ["games", id], queryFn: () => apiGet<Game[]>(`/communities/${id}/games`) });
  const tq = useQuery({ queryKey: ["tournaments", "community", id], queryFn: () => apiGet<Tournament[]>(`/tournaments?community_id=${id}`) });
  const c = cq.isError ? undefined : cq.data;
  const games = gq.isError ? [] : gq.data ?? [];
  const isAdmin = me?.role === "admin";
  const isOwner = !!me && !!c && c.owner_id === me.user_id;
  const canManage = !!c && (isAdmin || (isOwner && c.manage_active));
  const isMember = !!me && !!c && c.members.some((m) => m.user_id === me.user_id);
  const requested = !!me && !!c && c.join_requests.some((m) => m.user_id === me.user_id);
  const isHostView = isOwner || isAdmin;
  const canPlay = !!c && (c.visibility === "open" || isMember || isHostView);

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refreshAll(),
    onError: (e) => toast.error(errMsg(e)),
  });

  const needLogin = () => {
    toast("Sign in first");
    nav("/login");
  };

  const onManage = () => {
    if (!c) return;
    if (canManage) setManageOpen(true);
    else setSubFor(c);
  };

  return (
    <div>
      <header className="relative h-56 overflow-hidden">
        <img src={sportImage(c?.sport ?? "", c?.image)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,20,30,0.3) 0%, rgba(5,20,30,0.9) 80%, #05141E 100%)" }} />
        <button
          type="button"
          data-testid="back-button"
          onClick={() => nav(-1)}
          className="absolute left-4 top-4 rounded-full bg-black/40 p-2 backdrop-blur transition-colors hover:bg-black/60"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        {(isOwner || isAdmin) && c && (
          <button
            type="button"
            data-testid="community-manage-button"
            onClick={onManage}
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/40 transition-transform duration-150 active:scale-95"
          >
            {canManage ? <Settings2 className="size-4" /> : <Lock className="size-4" />}
            Manage
          </button>
        )}
        <div className="absolute bottom-4 left-5 right-5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-ice">
            {c?.sport ?? "Community"}
            {c && (
              <span data-testid="community-visibility-badge" className={c.visibility === "private" ? "rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-300" : "rounded-full bg-energy/20 px-2 py-0.5 text-energy"}>
                {c.visibility === "private" ? "Private" : "Open"}
              </span>
            )}
          </div>
          <h1 data-testid="community-title" className="font-heading text-3xl font-bold leading-tight tracking-tight">{c?.name ?? "Loading…"}</h1>
        </div>
      </header>

      {c && (
        <div className="space-y-6 px-5">
          {isOwner && !isAdmin && (
            <button
              type="button"
              data-testid="community-manage-upsell"
              onClick={() => setSubFor(c)}
              className="w-full rounded-2xl border border-energy/40 bg-gradient-to-r from-ice/10 to-energy/10 p-4 text-left text-sm transition-[border-color] duration-200 hover:border-energy"
            >
              {c.premium_active ? (
                <><span className="font-semibold text-energy">Paid until {fmtDate(c.manage_until ?? "", "d MMM")}.</span> Tap to pay OMR 1 for another 30 days.</>
              ) : c.in_trial ? (
                <><span className="font-semibold text-energy">Free trial until {fmtDate(c.trial_until ?? "", "d MMM")}.</span> Tournaments and photo uploads unlock when you pay OMR 1 for 30 days — pay any time.</>
              ) : (
                <><span className="font-semibold text-energy">Manage is locked.</span> Pay OMR 1 for 30 days to manage games, host tournaments and upload photos.</>
              )}
            </button>
          )}
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

          <div className="flex flex-wrap items-center gap-2">
            <ShareButtons
              path={`/communities/${c.id}`}
              text={`Join ${c.name} (${c.sport}, ${c.days.join(" & ") || "weekly"} ${c.time}) on Green Ocean Sporting Events — add your name to the next game!`}
              testid="community-share"
            />
            {!isMember && requested ? (
              <Button variant="outline" data-testid="community-request-pending" onClick={() => act.mutate(() => apiPost(`/communities/${id}/leave`), { onSuccess: () => toast("Request withdrawn") })}>
                Request pending · cancel
              </Button>
            ) : !isMember ? (
              <Button data-testid="community-join-button" onClick={() => (me ? act.mutate(() => apiPost(`/communities/${id}/join`), { onSuccess: () => toast.success("Request sent — the host will approve you") }) : needLogin())}>
                Request to join
              </Button>
            ) : !isOwner ? (
              <Button variant="outline" data-testid="community-leave-button" onClick={() => act.mutate(() => apiPost(`/communities/${id}/leave`))}>
                Leave community
              </Button>
            ) : null}
          </div>

          {isHostView && c.join_requests.length > 0 && (
            <section data-testid="join-requests" className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
              <h2 className="font-heading text-lg font-bold">Join requests ({c.join_requests.length})</h2>
              {c.join_requests.map((m) => (
                <div key={m.user_id} data-testid={`join-request-${m.user_id}`} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm"><Avatar name={m.name} picture={m.picture} /> <span className="truncate">{m.name}</span></span>
                  <span className="flex shrink-0 gap-1.5">
                    <Button size="sm" data-testid={`join-request-approve-${m.user_id}`} onClick={() => act.mutate(() => apiPost(`/communities/${id}/requests/${m.user_id}/approve`), { onSuccess: () => toast.success(`${m.name} approved`) })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" data-testid={`join-request-decline-${m.user_id}`} onClick={() => act.mutate(() => apiPost(`/communities/${id}/requests/${m.user_id}/decline`), { onSuccess: () => toast(`${m.name} declined`) })}>
                      Decline
                    </Button>
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold">Upcoming games</h2>
            {games.length ? (
              games.map((g) => <GameCard key={g.id} game={g} me={me} canManage={canManage} membersOnly={!canPlay} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No upcoming games scheduled.</div>
            )}
          </section>

          <Leaderboard communityId={c.id} />

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold">Community tournaments</h2>
            {!tq.isError && tq.data?.length ? (
              tq.data.map((t) => <TournamentCard key={t.id} t={t} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No tournaments in this community yet.</div>
            )}
          </section>

          <section className="space-y-3 pb-4">
            <h2 className="font-heading text-xl font-bold">Members</h2>
            <div className="flex flex-wrap gap-2" data-testid="community-members">
              {c.members.map((m) => (
                <span key={m.user_id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm">
                  <Avatar name={m.name} picture={m.picture} className="size-5" />
                  {m.name}
                </span>
              ))}
            </div>
          </section>

          <Gallery communityId={c.id} isHost={isAdmin || (isOwner && c.premium_active)} />
          {me && canManage && <ManageSheet key={c.id + c.name + c.fee} c={c} games={games} me={me} open={manageOpen} onOpenChange={setManageOpen} />}
        </div>
      )}
      <ManageSubscribeDialog community={subFor} onOpenChange={(o) => !o && setSubFor(null)} />
      {cq.isError && <div className="p-5 text-sm text-slate-400">Couldn't load this community.</div>}
    </div>
  );
}
