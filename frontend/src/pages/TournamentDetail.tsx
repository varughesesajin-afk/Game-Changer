import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Crown, MapPin, Plus, Trash2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Fixtures from "@/components/Fixtures";
import TeamLogo from "@/components/TeamLogo";
import Standings from "@/components/Standings";
import { formatLabel } from "@/lib/formats";
import ShareButtons from "@/components/ShareButtons";
import { StatusBadge } from "@/components/TournamentCard";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, money, refreshAll, sportImage, useMe } from "@/lib/auth";
import type { Team, Tournament } from "@/lib/types";

function TeamRow({ t, team, canEdit }: { t: Tournament; team: Team; canEdit: boolean }) {
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => apiPost<Tournament>(`/tournaments/${t.id}/teams/${team.id}/players`, { name: name.trim() }),
    onSuccess: () => {
      setName("");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const withdraw = useMutation({
    mutationFn: () => apiDelete<Tournament>(`/tournaments/${t.id}/teams/${team.id}`),
    onSuccess: () => {
      toast("Team withdrawn");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const champ = t.champion_id === team.id;
  return (
    <div data-testid={`team-row-${team.id}`} className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TeamLogo t={t} team={team} canEdit={canEdit} />
          <span className="font-heading text-lg font-bold">{team.name}</span>
          {champ && <Crown className="size-4 text-amber-400" />}
        </div>
        <span className="text-xs text-slate-500">Capt. {team.captain_name}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {team.players.map((p, i) => (
          <span key={`${p}-${i}`} className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-slate-200">{p}</span>
        ))}
      </div>
      {canEdit && (
        <div className="mt-3 flex gap-2">
          <Input data-testid={`team-add-player-input-${team.id}`} placeholder="Add player name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" data-testid={`team-add-player-button-${team.id}`} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
            <Plus className="size-4" />
          </Button>
          {t.status === "registration" && (
            <Button size="sm" variant="ghost" aria-label="Withdraw team" data-testid={`team-withdraw-button-${team.id}`} onClick={() => withdraw.mutate()}>
              <Trash2 className="size-4 text-red-400" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TournamentDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState("");
  const [tab, setTab] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["tournament", id], queryFn: () => apiGet<Tournament>(`/tournaments/${id}`) });
  const t = q.isError ? undefined : q.data;
  const canManage = !!me && !!t && (t.organiser_id === me.user_id || me.role === "admin");
  const myTeam = t && me ? t.teams.find((x) => x.captain_id === me.user_id) : undefined;

  const register = useMutation({
    mutationFn: () =>
      apiPost<Tournament>(`/tournaments/${id}/teams`, {
        name: teamName.trim(),
        players: players.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Team registered!");
      setTeamName("");
      setPlayers("");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const start = useMutation({
    mutationFn: () => apiPost<Tournament>(`/tournaments/${id}/start`),
    onSuccess: () => {
      toast.success("Bracket drawn — let the games begin!");
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <header className="relative h-60 overflow-hidden">
        <img src={sportImage(t?.sport ?? "", t?.image)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,20,30,0.3) 0%, rgba(5,20,30,0.92) 80%, #05141E 100%)" }} />
        <button type="button" data-testid="back-button" onClick={() => nav(-1)} aria-label="Back" className="absolute left-4 top-4 rounded-full bg-black/40 p-2 backdrop-blur transition-colors hover:bg-black/60">
          <ArrowLeft className="size-5" />
        </button>
        {t && (
          <div className="absolute bottom-4 left-5 right-5 space-y-1.5">
            <div className="flex gap-1.5">
              <StatusBadge status={t.status} />
              {t.kind === "official" ? (
                <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white">Official</span>
              ) : t.community_id ? (
                <Link to={`/communities/${t.community_id}`} className="rounded-full bg-ice/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-ice">
                  {t.community_name}
                </Link>
              ) : null}
            </div>
            <h1 data-testid="tournament-title" className="font-heading text-3xl font-bold leading-tight tracking-tight">{t.title}</h1>
          </div>
        )}
      </header>

      {t && (
        <div className="space-y-6 px-5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Prize pool", value: money(t.prize_pool, t.currency), accent: true },
              { label: "Entry / team", value: money(t.entry_fee, t.currency) },
              { label: "Teams", value: `${t.teams.length}/${t.max_teams}` },
              { label: "Squad size", value: `${t.team_size} players` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-surface p-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{s.label}</div>
                <div className={`font-heading text-xl font-bold ${s.accent ? "text-energy" : ""}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm text-slate-300">
            <p className="flex items-center gap-1.5 text-slate-400"><CalendarDays className="size-4" />{fmtDate(t.start_date, "EEEE d MMMM yyyy")}</p>
            <p className="flex items-center gap-1.5 text-slate-400"><MapPin className="size-4" />{t.venue}{t.city ? `, ${t.city}` : ""}</p>
            <p className="flex items-center gap-1.5 text-slate-400"><Users className="size-4" />{t.sport} · organised by {t.organiser_name}</p>
            <p data-testid="tournament-format" className="text-slate-400"><Trophy className="mr-1.5 inline size-4 align-[-3px]" />Format: <span className="font-semibold text-white">{formatLabel(t.format)}</span>
              {(t.format === "league" || t.format === "groups_knockout" || t.format === "league_playoffs") && t.league_legs === 2 ? " · home & away" : ""}
              {t.format === "groups_knockout" ? ` · ${t.group_count} groups, top ${t.advance_per_group} advance` : ""}
              {t.format === "league_playoffs" ? ` · top ${t.playoff_teams} to playoffs` : ""}</p>
            {t.description && <p className="pt-1">{t.description}</p>}
          </div>

          <ShareButtons
            path={`/tournaments/${t.id}`}
            text={`${t.title} — ${t.sport} tournament on ${fmtDate(t.start_date, "d MMM")}. ${t.status === "registration" ? "Register your team" : "Follow the bracket"} on Green Ocean Sporting Events:`}
            testid="tournament-share"
          />

          {canManage && t.status === "registration" && (
            <Button data-testid="tournament-start-button" className="w-full" disabled={t.teams.length < 2 || start.isPending} onClick={() => start.mutate()}>
              Close registration & draw bracket
            </Button>
          )}

          {t.champion_id && (
            <div data-testid="tournament-champion-banner" className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
              <Crown className="size-8 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-amber-300">Champions</div>
                <div className="font-heading text-xl font-bold">{t.teams.find((x) => x.id === t.champion_id)?.name}</div>
              </div>
            </div>
          )}

          <Tabs value={tab ?? (t.status === "registration" ? "teams" : "fixtures")} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full">
              <TabsTrigger value="teams" data-testid="tournament-tab-teams" className="flex-1">Teams ({t.teams.length})</TabsTrigger>
              <TabsTrigger value="standings" data-testid="tournament-tab-standings" className="flex-1">Standings</TabsTrigger>
              <TabsTrigger value="fixtures" data-testid="tournament-tab-fixtures" className="flex-1">Fixtures</TabsTrigger>
            </TabsList>
            <TabsContent value="teams" className="space-y-3 pt-3">
              {t.status === "registration" && !myTeam && t.teams.length < t.max_teams && (
                <div data-testid="register-team-form" className="space-y-3 rounded-2xl border border-energy/40 bg-gradient-to-br from-energy/10 to-surface p-4">
                  <div className="font-heading text-lg font-bold">Register your team</div>
                  {me ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="team-name">Team name</Label>
                        <Input id="team-name" data-testid="register-team-name-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="team-players">Players (comma separated)</Label>
                        <Input id="team-players" data-testid="register-team-players-input" placeholder="Ali, Ben, Chris" value={players} onChange={(e) => setPlayers(e.target.value)} />
                      </div>
                      <Button data-testid="register-team-submit" className="w-full" disabled={!teamName.trim() || register.isPending} onClick={() => register.mutate()}>
                        Register team {t.entry_fee ? `· ${money(t.entry_fee, t.currency)} at venue` : ""}
                      </Button>
                    </>
                  ) : (
                    <Button data-testid="register-team-signin" className="w-full" onClick={() => nav("/login")}>Sign in to register</Button>
                  )}
                </div>
              )}
              {t.teams.map((team) => (
                <TeamRow key={team.id} t={t} team={team} canEdit={!!me && (team.captain_id === me.user_id || canManage)} />
              ))}
              {t.teams.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-slate-500">No teams yet — be the first.</div>}
            </TabsContent>
            <TabsContent value="standings" className="pt-3">
              <Standings t={t} />
            </TabsContent>
            <TabsContent value="fixtures" className="pt-3">
              <Fixtures t={t} canManage={canManage} />
            </TabsContent>
          </Tabs>
          {canManage && (
            <Button
              variant="ghost"
              data-testid="tournament-delete-button"
              className="w-full text-red-400"
              onClick={() => {
                if (window.confirm("Delete this tournament?"))
                  apiDelete(`/tournaments/${t.id}`).then(() => {
                    refreshAll();
                    nav("/tournaments");
                  }).catch((e: unknown) => toast.error(errMsg(e)));
              }}
            >
              Delete tournament
            </Button>
          )}
        </div>
      )}
      {q.isError && <div className="p-5 text-sm text-slate-400">Couldn't load this tournament.</div>}
    </div>
  );
}
