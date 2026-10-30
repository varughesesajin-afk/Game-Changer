import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import GameCard from "@/components/GameCard";
import CommunityCard from "@/components/CommunityCard";
import TournamentCard from "@/components/TournamentCard";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { endSession } from "@/lib/session";
import ProfilePicture from "@/components/ProfilePicture";
import MyStats from "@/components/MyStats";
import type { Community, Game, Tournament } from "@/lib/types";

export default function Profile() {
  const { data: me, isLoading } = useMe();
  const games = useQuery({ queryKey: ["games", "mine"], queryFn: () => apiGet<Game[]>("/games/mine"), enabled: !!me });
  const comms = useQuery({ queryKey: ["communities", "mine"], queryFn: () => apiGet<Community[]>("/communities?mine=true"), enabled: !!me });
  const tours = useQuery({ queryKey: ["tournaments", "mine"], queryFn: () => apiGet<Tournament[]>("/tournaments?mine=true"), enabled: !!me });

  if (isLoading) return <div className="p-5"><div className="h-24 animate-pulse rounded-2xl bg-surface" /></div>;

  if (!me) {
    return (
      <div className="space-y-4 px-5 pt-16 text-center">
        <h1 className="font-heading text-3xl font-bold">Your games live here</h1>
        <p className="text-sm text-slate-400">Sign in to see the games you've joined, your groups and your teams.</p>
        <Link to="/login" data-testid="profile-signin-button" className={buttonVariants({ size: "lg" })}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-7 px-5 pt-6">
      <div className="flex items-center gap-4">
        <ProfilePicture me={me} />
        <div className="min-w-0 flex-1">
          <h1 data-testid="profile-name" className="truncate font-heading text-2xl font-bold uppercase tracking-wide">{me.name}</h1>
          <div className="truncate text-sm text-slate-400">{me.email}</div>
          <div className="mt-1 flex gap-1.5">
            {me.role === "admin" && (
              <span data-testid="profile-admin-badge" className="inline-flex items-center gap-1 rounded-full bg-energy/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-energy">
                <ShieldCheck className="size-3" /> Admin
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Sign out" data-testid="logout-button" onClick={() => void endSession("/")}>
          <LogOut className="size-5" />
        </Button>
      </div>

      {me.role === "admin" ? (
        <Link to="/admin" data-testid="profile-admin-dashboard-link" className="block rounded-2xl border border-ice/40 bg-gradient-to-r from-ice/15 to-energy/15 p-4 text-sm">
          <span className="font-semibold text-ice">Site admin dashboard</span> — users, communities, subscriptions and revenue.
        </Link>
      ) : (
        <Link to="/monetize" data-testid="profile-manage-link" className="block rounded-2xl border border-energy/40 bg-energy/10 p-4 text-sm">
          <span className="font-semibold text-energy">Run a community?</span> Unlock Manage for OMR 1/month.
        </Link>
      )}

      <MyStats userId={me.user_id} />

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold">My upcoming games</h2>
        {games.data?.length ? (
          games.data.map((g) => <GameCard key={g.id} game={g} me={me} showCommunity compact />)
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">
            You haven't added your name to any games. <Link to="/communities" className="text-ice hover:underline">Find a group</Link>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold">My communities</h2>
        {comms.data?.length ? comms.data.map((c) => <CommunityCard key={c.id} c={c} badge={c.owner_id === me.user_id ? "Host" : undefined} />) : (
          <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No groups yet.</div>
        )}
      </section>

      <section className="space-y-3 pb-4">
        <h2 className="font-heading text-xl font-bold">My tournaments</h2>
        {tours.data?.length ? tours.data.map((t) => <TournamentCard key={t.id} t={t} badge={t.organiser_id === me.user_id ? "Organiser" : undefined} />) : (
          <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No tournaments yet.</div>
        )}
      </section>
    </div>
  );
}
