import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, Coins, ShieldAlert, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { fmtDate, useMe } from "@/lib/auth";
import type { AdminOverview } from "@/lib/types";

export default function Admin() {
  const { data: me, isLoading } = useMe();
  const isAdmin = me?.role === "admin";
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => apiGet<AdminOverview>("/admin/overview"), enabled: isAdmin });
  const d = q.isError ? undefined : q.data;

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
        { icon: Users, label: "Users", value: d.stats.users },
        { icon: Activity, label: "Communities", value: d.stats.communities },
        { icon: Coins, label: "Managed (paying)", value: d.stats.managed_communities },
        { icon: Trophy, label: "Tournaments", value: d.stats.tournaments },
        { icon: CalendarDays, label: "Upcoming games", value: d.stats.upcoming_games },
        { icon: Coins, label: "Revenue 30d", value: `${d.stats.currency} ${d.stats.revenue_30d}` },
      ]
    : [];

  return (
    <div className="space-y-6 px-5 pt-6" data-testid="admin-dashboard">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Site admin</div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
        {d && <p className="text-sm text-slate-400">All-time revenue: <span data-testid="admin-revenue-total" className="font-semibold text-white">{d.stats.currency} {d.stats.revenue_total}</span> <span className="text-xs">(test payments)</span></p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} data-testid={`admin-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="rounded-xl border border-line bg-surface p-3">
            <Icon className="size-4 text-ice" />
            <div className="mt-1 font-heading text-2xl font-bold">{value}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</div>
          </div>
        ))}
        {q.isLoading && <div className="col-span-2 h-40 animate-pulse rounded-xl bg-surface" />}
      </div>

      <Tabs defaultValue="communities">
        <TabsList className="w-full">
          <TabsTrigger value="communities" data-testid="admin-tab-communities" className="flex-1">Communities</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users" className="flex-1">Users</TabsTrigger>
          <TabsTrigger value="payments" data-testid="admin-tab-payments" className="flex-1">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="communities" className="space-y-2 pt-3">
          {d?.communities.map((c) => (
            <Link key={c.id} to={`/communities/${c.id}`} data-testid={`admin-community-${c.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 transition-[border-color] hover:border-ice/50">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="truncate text-xs text-slate-400">{c.sport} · {c.owner_name} · {c.members.length} members</div>
              </div>
              {c.manage_active ? <Badge className="bg-energy/20 text-energy">Managed</Badge> : <Badge variant="outline">Free</Badge>}
            </Link>
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
        <TabsContent value="payments" className="space-y-2 pb-4 pt-3">
          {d?.payments.length === 0 && <p className="text-sm text-slate-400">No payments yet.</p>}
          {d?.payments.map((p) => (
            <div key={p.id} data-testid={`admin-payment-${p.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.community_name ?? p.plan_id}</div>
                <div className="truncate text-xs text-slate-400">{p.user_name || p.user_id} · {fmtDate(p.created_at, "d MMM yyyy")}{p.mocked ? " · test" : ""}</div>
              </div>
              <span className="shrink-0 font-semibold">{p.currency} {p.amount}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
