import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SportPills from "@/components/SportPills";
import TournamentCard from "@/components/TournamentCard";
import CreateTournamentDialog from "@/components/CreateTournamentDialog";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { Community, Tournament, TournamentKind } from "@/lib/types";

export default function Tournaments() {
  const nav = useNavigate();
  const { data: me } = useMe();
  const [kind, setKind] = useState<TournamentKind>("official");
  const [sport, setSport] = useState("All");
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ["tournaments", kind, sport],
    queryFn: () => apiGet<Tournament[]>(`/tournaments?kind=${kind}&sport=${encodeURIComponent(sport)}`),
  });
  const mine = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: () => apiGet<Community[]>("/communities?mine=true"),
    enabled: !!me,
  });
  const owned = (mine.data ?? []).filter((c) => c.owner_id === me?.user_id);
  const isAdmin = me?.role === "admin";
  const createKind: TournamentKind = isAdmin && kind === "official" ? "official" : "community";

  const create = () => {
    if (!me) {
      toast("Sign in to host a tournament");
      nav("/login");
      return;
    }
    if (createKind === "community" && !me.is_pro && !isAdmin) {
      toast("Hosting tournaments is an Organiser Pro feature");
      nav("/monetize");
      return;
    }
    setOpen(true);
  };

  return (
    <div className="space-y-5 px-5 pt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-energy">Compete</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Tournaments</h1>
        </div>
        <Button data-testid="create-tournament-button" onClick={create}>
          <Plus className="size-4" /> {createKind === "official" ? "Official" : "Host"}
        </Button>
      </div>
      <Tabs value={kind} onValueChange={(v) => setKind(v as TournamentKind)}>
        <TabsList className="w-full">
          <TabsTrigger value="official" data-testid="tournaments-tab-official" className="flex-1">Official</TabsTrigger>
          <TabsTrigger value="community" data-testid="tournaments-tab-community" className="flex-1">Community</TabsTrigger>
        </TabsList>
      </Tabs>
      <SportPills value={sport} onChange={setSport} />
      <div className="space-y-4" data-testid="tournament-list">
        {!list.isError && list.data?.map((t) => <TournamentCard key={t.id} t={t} />)}
        {(list.isError || list.data?.length === 0) && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-slate-500">No tournaments here yet.</div>
        )}
        {list.isLoading && <div className="h-48 animate-pulse rounded-2xl bg-surface" />}
      </div>
      {me && <CreateTournamentDialog key={createKind + owned.length} open={open} onOpenChange={setOpen} kind={createKind} communities={owned} />}
    </div>
  );
}
