import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SportPills from "@/components/SportPills";
import CommunityCard from "@/components/CommunityCard";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { Community } from "@/lib/types";

export default function Communities() {
  const nav = useNavigate();
  const { data: me } = useMe();
  const [sport, setSport] = useState("All");
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["communities", sport, q],
    queryFn: () => apiGet<Community[]>(`/communities?sport=${encodeURIComponent(sport)}&q=${encodeURIComponent(q)}`),
  });

  const start = () => {
    if (!me) {
      toast("Sign in to start a community");
      nav("/login");
      return;
    }
    nav("/communities/new");
  };

  return (
    <div className="space-y-5 px-5 pt-6 lg:px-6 lg:pt-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ice">Recurring games</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight lg:text-4xl">Communities</h1>
        </div>
        <Button data-testid="start-community-button" onClick={start}>
          <Plus className="size-4" /> Start one
        </Button>
      </div>
      <div className="relative lg:max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input data-testid="community-search-input" placeholder="Search groups" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <SportPills value={sport} onChange={setSport} />
      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3 2xl:grid-cols-4" data-testid="community-list">
        {!list.isError && list.data?.map((c) => <CommunityCard key={c.id} c={c} />)}
        {(list.isError || list.data?.length === 0) && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-slate-500 lg:col-span-full">
            No groups found. Be the first to start one.
          </div>
        )}
        {list.isLoading && <div className="h-24 animate-pulse rounded-2xl bg-surface lg:col-span-full" />}
      </div>
    </div>
  );
}
