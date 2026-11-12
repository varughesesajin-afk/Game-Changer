import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Trophy } from "lucide-react";
import SportPills from "@/components/SportPills";
import TournamentCard from "@/components/TournamentCard";
import CommunityCard from "@/components/CommunityCard";
import GameCard from "@/components/GameCard";
import { apiGet } from "@/lib/api";
import { HERO_IMG, useMe } from "@/lib/auth";
import Brand from "@/components/Brand";
import type { Feed } from "@/lib/types";

function Section({ title, to, testid, children }: { title: string; to?: string; testid: string; children: React.ReactNode }) {
  return (
    <section data-testid={testid} className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="font-heading text-xl font-bold tracking-tight text-white">{title}</h2>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-ice hover:underline">
            See all <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">{text}</div>;
}

export default function Explore() {
  const [sport, setSport] = useState("All");
  const { data: me } = useMe();
  const feed = useQuery({ queryKey: ["feed", sport], queryFn: () => apiGet<Feed>(`/feed?sport=${encodeURIComponent(sport)}`) });
  const f = feed.isError ? undefined : feed.data;

  return (
    <div>
      <header className="relative h-72 overflow-hidden">
        <img src={HERO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,20,30,0.4) 0%, rgba(5,20,30,0.92) 85%, #05141E 100%)" }} />
        <div className="relative flex h-full flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <Brand tagline />
            {me ? (
              <Link to="/profile" data-testid="header-profile-link" className="text-sm font-semibold text-slate-200">
                Hi, {me.name.split(" ")[0]}
              </Link>
            ) : (
              <Link to="/login" data-testid="header-signin-link" className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold backdrop-blur hover:bg-white/20">
                Sign in
              </Link>
            )}
          </div>
          <div className="animate-rise space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
              <Trophy className="size-3" /> Game on
            </div>
            <h1 data-testid="hero-title" className="font-heading text-4xl font-bold leading-[1.05] tracking-tight">
              <span className="text-brand">Green Ocean</span><br />Sporting Events
            </h1>
            <p className="text-sm text-slate-200">Game on. Your weekly game, your city's tournaments — every sport.</p>
          </div>
        </div>
      </header>

      <div className="space-y-8 px-5 pt-2">
        <SportPills value={sport} onChange={setSport} />

        <Section title="Official tournaments" to="/tournaments" testid="feed-official-section">
          {f?.official.length ? (
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
              {f.official.map((t) => <TournamentCard key={t.id} t={t} wide />)}
            </div>
          ) : (
            <Empty text={feed.isLoading ? "Loading…" : "No official tournaments for this sport yet."} />
          )}
        </Section>

        <Section title="Games this week" to="/communities" testid="feed-games-section">
          {f?.upcoming_games.length ? (
            <div className="space-y-3">
              {f.upcoming_games.slice(0, 4).map((g) => <GameCard key={g.id} game={g} me={me} showCommunity compact />)}
            </div>
          ) : (
            <Empty text={feed.isLoading ? "Loading…" : "No games scheduled — start a community!"} />
          )}
        </Section>

        <Section title="Community tournaments" to="/tournaments" testid="feed-community-tournaments-section">
          {f?.community_tournaments.length ? (
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
              {f.community_tournaments.map((t) => <TournamentCard key={t.id} t={t} wide />)}
            </div>
          ) : (
            <Empty text="No community tournaments right now." />
          )}
        </Section>

        <Section title="Groups near you" to="/communities" testid="feed-communities-section">
          {f?.communities.length ? (
            <div className="space-y-3">{f.communities.slice(0, 4).map((c) => <CommunityCard key={c.id} c={c} />)}</div>
          ) : (
            <Empty text="No groups yet." />
          )}
        </Section>

        <Link
          to="/monetize"
          data-testid="feed-host-cta"
          className="block rounded-2xl border border-energy/40 bg-gradient-to-br from-energy/20 via-surface to-surface p-5 transition-[border-color] duration-200 hover:border-energy"
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Organisers</div>
          <div className="mt-1 font-heading text-xl font-bold">Run your community like a club.</div>
          <p className="mt-1 text-sm text-slate-300">Start a community, get the admin's approval, then edit details, schedule games, host tournaments and track match fees.</p>
        </Link>
      </div>
    </div>
  );
}
