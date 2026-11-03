import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CircleX, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { errMsg, refreshAll } from "@/lib/auth";
import { startManageCheckout } from "@/lib/payments";
import type { CheckoutStatus } from "@/lib/types";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const cancelled = params.get("cancelled") === "1";
  const tries = useRef(0);
  const st = useQuery({
    queryKey: ["checkout", ref],
    queryFn: async () => {
      tries.current += 1;
      const s = await apiGet<CheckoutStatus>(`/billing/checkout/${ref}`);
      if (s.paid) refreshAll();
      return s;
    },
    enabled: !!ref,
    // Thawani can take a moment to confirm — keep checking briefly unless the user cancelled
    refetchInterval: (q) => (cancelled || q.state.data?.paid || tries.current > 10 ? false : 3000),
  });
  const retry = useMutation({ mutationFn: () => startManageCheckout(st.data!.community_id), onError: (e) => toast.error(errMsg(e)) });
  const s = st.data;
  const waiting = !s || (!s.paid && !cancelled && tries.current <= 10);

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center gap-5 px-6 py-10" data-testid="payment-return-page">
      {st.isError ? (
        <p data-testid="payment-error" className="text-sm text-red-400">{errMsg(st.error)}</p>
      ) : s?.paid ? (
        <>
          <BadgeCheck className="size-14 text-energy" />
          <div>
            <h1 data-testid="payment-status-title" className="font-heading text-3xl font-bold tracking-tight">Payment confirmed</h1>
            <p className="mt-2 text-slate-300">OMR 1 paid — <span className="font-semibold text-white">{s.community_name}</span> has 30 more days of full Manage, including tournaments and photo uploads.</p>
          </div>
          <Link to={`/communities/${s.community_id}`} data-testid="payment-open-community" className={buttonVariants({ className: "w-full bg-brand text-white" })}>Open my community</Link>
        </>
      ) : waiting ? (
        <>
          <Loader2 className="size-12 animate-spin text-ice" />
          <h1 data-testid="payment-status-title" className="font-heading text-2xl font-bold">Confirming your payment…</h1>
        </>
      ) : (
        <>
          <CircleX className="size-14 text-red-400" />
          <div>
            <h1 data-testid="payment-status-title" className="font-heading text-3xl font-bold tracking-tight">Payment not completed</h1>
            <p className="mt-2 text-slate-300">No money was taken. <span className="font-semibold text-white">{s.community_name}</span> is saved — pay OMR 1 whenever you're ready.</p>
          </div>
          <Button data-testid="payment-retry" className="w-full bg-brand text-white" disabled={retry.isPending} onClick={() => retry.mutate()}>
            {retry.isPending ? "Opening checkout…" : "Try again — pay OMR 1"}
          </Button>
          <Link to={`/communities/${s.community_id}`} data-testid="payment-open-community" className={buttonVariants({ variant: "outline", className: "w-full" })}>Back to community</Link>
        </>
      )}
    </div>
  );
}
