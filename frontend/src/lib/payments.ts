import { apiPost } from "@/lib/api";
import type { CheckoutStart } from "@/lib/types";

/** Start the one-time OMR 1 Thawani checkout for a community and leave the app for the secure payment page. */
export async function startManageCheckout(communityId: string): Promise<void> {
  const s = await apiPost<CheckoutStart>(`/billing/communities/${communityId}/checkout`);
  window.location.assign(s.redirect_url);
}
