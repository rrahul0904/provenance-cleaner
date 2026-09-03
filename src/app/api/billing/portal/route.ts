import { getRequestIdentity } from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { publicAppOrigin } from "@/lib/server/env";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const context = requestContext(request, "/api/billing/portal");
  const identity = await getRequestIdentity();
  if (!identity || identity.isAnonymous) return apiError(context, "registered_account_required", "Sign in with a registered account to manage a monthly plan.", 401);
  const { data } = await createAdminClient().rpc("billing_get_stripe_customer", { p_user_id: identity.userId });
  const customerId = (data as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!customerId) return apiError(context, "subscription_not_found", "No monthly plan is associated with this account.", 404);
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${publicAppOrigin(request)}/account` });
    return apiOk(context, { url: session.url });
  } catch { return apiError(context, "billing_portal_unavailable", "Subscription management is not available.", 503); }
}
