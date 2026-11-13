import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, CalendarDays, CheckCircle2, ClockAlert, ShieldAlert, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, fmtDate, refreshAll, useMe } from "@/lib/auth";
import type { AdminOverview, Community } from "@/lib/types";

/** One approval action: POST to an /admin/... path, then refresh the whole dashboard. */
function useDecision() {
  return useMutation({
    mutationFn: (v: { path: string; done: string }) => apiPost(`/admin/${v.path}`).then(() => v.done),
    onSuccess: (done) => {
      toast.success(done);
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

function QueueRow({ testid, title, sub, to, children }: { testid: string; title: string; sub: string; to: string; children: React.ReactNode }) {
  return (
    <div data-testid={testid} className="space-y-2 rounded-xl border border-line bg-surface p-3">
      <Link to={to} className="block min-w-0 hover:opacity-90">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-slate-400">{sub}</div>
      </Link>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function communityStatus(c: Community) {
  if (c.manage_active) return <Badge className="bg-energy/20 text-energy">Manage until {fmtDate(c.manage_until ?? "", "d MMM")}</Badge>;
  return <Badge variant="outline">Manage locked</Badge>;
}

export default function Admin() {
  const { data: me, isLoading } = useMe();
  const isAdmin = me?.role === "admin";
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => apiGet<AdminOverview>("/admin/overview"), enabled: isAdmin });
  const d = q.isError ? undefined : q.data;
  const decide = useDecision();

  if (!isLoading && !isAdmin) {
    return (
      <div className="space-y-3 px-5 pt-16 text-center" data-testid="admin-forbidden">
        <ShieldAlert className="mx-auto size-10 text-red-400" />
        <h1 className="font-heading text-2xl font-bold">Admins only</h1>
        <Link to="/" className="text-sm text-ice hover:underline">Back to Explore</Link>
      </div>
    );
  }

  const stats = d
    ? [
        { icon: ClockAlert, label: "Waiting for you", value: d.stats.pending_approvals },
        { icon: Users, label: "Users", value: d.stats.users },
        { icon: Activity, label: "Communities", value: d.stats.communities },
        { icon: CheckCircle2, label: "Manage active", value: d.stats.managed_communities },
        { icon: Trophy, label: "Tournaments", value: d.stats.tournaments },
        { icon: CalendarDays, label: "Upcoming games", value: d.stats.upcoming_games },
      ]
    : [];
  const act = (path: string, done: string) => decide.mutate({ path, done });

  return (
    <div className="space-y-6 px-5 pt-6 lg:px-6 lg:pt-10" data-testid="admin-dashboard">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Site admin</div>
        <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">Dashboard</h1>
        <p className="text-sm text-slate-400">New communities, 30-day Manage periods and community tournaments all wait here for your approval.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} data-testid={`admin-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="rounded-xl border border-line bg-surface p-3">
            <Icon className="size-4 text-ice" />
            <div className="mt-1 font-heading text-2xl font-bold">{value}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</div>
          </div>
        ))}
        {q.isLoading && <div className="col-span-2 h-40 animate-pulse rounded-xl bg-surface" />}
      </div>

      <Tabs defaultValue="approvals">
        <TabsList className="w-full lg:w-[36rem]">
          <TabsTrigger value="approvals" data-testid="admin-tab-approvals" className="flex-1">Approvals{d?.stats.pending_approvals ? ` (${d.stats.pending_approvals})` : ""}</TabsTrigger>
          <TabsTrigger value="communities" data-testid="admin-tab-communities" className="flex-1">Communities</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users" className="flex-1">Users</TabsTrigger>
          <TabsTrigger value="formats" data-testid="admin-tab-formats" className="flex-1">Formats{d?.custom_formats.length ? ` (${d.custom_formats.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-5 pb-4 pt-3 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0">
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold">New communities</h2>
            {d?.pending_communities.length === 0 && <p className="text-sm text-slate-400">Nothing waiting.</p>}
            {d?.pending_communities.map((c) => (
              <QueueRow key={c.id} testid={`admin-pending-community-${c.id}`} title={c.name} sub={`${c.sport} · requested by ${c.owner_name}${c.city ? ` · ${c.city}` : ""}`} to={`/communities/${c.id}`}>
                <Button size="sm" data-testid={`admin-approve-community-${c.id}`} className="flex-1 bg-brand text-white" disabled={decide.isPending} onClick={() => act(`communities/${c.id}/approve`, `${c.name} approved — 30 days of Manage granted`)}>Approve</Button>
                <Button size="sm" variant="outline" data-testid={`admin-decline-community-${c.id}`} className="flex-1" disabled={decide.isPending} onClick={() => act(`communities/${c.id}/decline`, `${c.name} declined`)}>Decline</Button>
              </QueueRow>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold">Manage requests</h2>
            {d?.manage_requests.length === 0 && <p className="text-sm text-slate-400">Nothing waiting.</p>}
            {d?.manage_requests.map((c) => (
              <QueueRow key={c.id} testid={`admin-manage-request-${c.id}`} title={c.name} sub={`${c.owner_name} · ${c.manage_active ? `current period ends ${fmtDate(c.manage_until ?? "", "d MMM")}` : "Manage is locked"}`} to={`/communities/${c.id}`}>
                <Button size="sm" data-testid={`admin-approve-manage-${c.id}`} className="flex-1 bg-brand text-white" disabled={decide.isPending} onClick={() => act(`communities/${c.id}/manage/approve`, `${c.name}: another 30 days approved`)}>Approve 30 days</Button>
                <Button size="sm" variant="outline" data-testid={`admin-decline-manage-${c.id}`} className="flex-1" disabled={decide.isPending} onClick={() => act(`communities/${c.id}/manage/decline`, "Request declined")}>Decline</Button>
              </QueueRow>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold">Community tournaments</h2>
            {d?.pending_tournaments.length === 0 && <p className="text-sm text-slate-400">Nothing waiting.</p>}
            {d?.pending_tournaments.map((t) => (
              <QueueRow key={t.id} testid={`admin-pending-tournament-${t.id}`} title={t.title} sub={`${t.sport} · ${t.organiser_name}${t.community_name ? ` · ${t.community_name}` : ""} · starts ${fmtDate(t.start_date, "d MMM")}`} to={`/tournaments/${t.id}`}>
                <Button size="sm" data-testid={`admin-approve-tournament-${t.id}`} className="flex-1 bg-brand text-white" disabled={decide.isPending} onClick={() => act(`tournaments/${t.id}/approve`, `${t.title} approved`)}>Approve</Button>
                <Button size="sm" variant="outline" data-testid={`admin-decline-tournament-${t.id}`} className="flex-1" disabled={decide.isPending} onClick={() => act(`tournaments/${t.id}/decline`, `${t.title} declined`)}>Decline</Button>
              </QueueRow>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="communities" className="space-y-2 pt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          {d?.communities.map((c) => (
            <div key={c.id} data-testid={`admin-community-${c.id}`} className="space-y-2 rounded-xl border border-line bg-surface px-3 py-2">
              <Link to={`/communities/${c.id}`} className="flex items-center justify-between gap-2 transition-opacity hover:opacity-90">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-slate-400">{c.sport} · {c.owner_name} · {c.members.length} members</div>
                </div>
                {communityStatus(c)}
              </Link>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" data-testid={`admin-extend-${c.id}`} className="flex-1" disabled={decide.isPending} onClick={() => act(`communities/${c.id}/manage/approve`, `${c.name}: +30 days of Manage`)}>+30 days</Button>
                {c.manage_active && (
                  <Button size="sm" variant="outline" data-testid={`admin-revoke-${c.id}`} className="flex-1 text-red-400" disabled={decide.isPending} onClick={() => act(`communities/${c.id}/manage/revoke`, `${c.name}: Manage switched off`)}>Switch off</Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="users" className="space-y-2 pt-3">
          {d?.users.map((u) => (
            <div key={u.user_id} data-testid={`admin-user-${u.user_id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{u.name}</div>
                <div className="truncate text-xs text-slate-400">{u.email}</div>
              </div>
              <div className="shrink-0 text-right text-xs">
                {u.role === "admin" ? <Badge className="bg-brand text-white">Admin</Badge> : <span className="text-slate-400">{u.communities_owned ? "Organiser" : "Player"}</span>}
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="formats" className="space-y-2 pb-4 pt-3">
          {d?.custom_formats.length === 0 && <p className="text-sm text-slate-400">No custom format requests.</p>}
          {d?.custom_formats.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} data-testid={`admin-format-${t.id}`} className="block rounded-xl border border-line bg-surface px-3 py-2 text-sm transition-[border-color] hover:border-ice/50">
              <div className="font-semibold">{t.title}</div>
              <div className="text-xs text-slate-400">{t.sport} · {t.organiser_name}{t.community_name ? ` · ${t.community_name}` : ""}</div>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-300">{t.format_notes}</p>
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
