import { getRequestIdentity } from "@/lib/auth/identity";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { publicAppOrigin } from "@/lib/server/env";

export const runtime = "nodejs";

function customerId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as { stripe_customer_id?: unknown }).stripe_customer_id;
  return typeof id === "string" && /^cus_/u.test(id) ? id : null;
}

export async function POST(request: Request) {
  const context = requestContext(request, "/api/billing/portal");
  try {
    const identity = await getRequestIdentity();
    if (!identity || identity.isAnonymous) return apiError(context, "registered_account_required", "Sign in with a registered account to manage billing.", 401);

    const { data, error } = await createAdminClient().rpc("billing_get_stripe_customer", { p_user_id: identity.userId });
    if (error) return apiError(context, "billing_lookup_failed", "Billing details are unavailable.", 503);
    const customer = customerId(data);
    if (!customer) return apiError(context, "billing_customer_missing", "No Stripe customer is linked to this account yet.", 409);

    const stripe = getStripe();
    const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const configuration = configs.data.find(config => config.metadata?.app === "provenance-cleaner" && config.metadata?.environment === "test");
    if (!configuration) return apiError(context, "billing_portal_not_configured", "Billing Portal is not configured.", 503);

    const session = await stripe.billingPortal.sessions.create({
      customer,
      configuration: configuration.id,
      return_url: `${publicAppOrigin(request)}/account`,
    });
    return apiOk(context, { url: session.url });
  } catch {
    return apiError(context, "billing_portal_unavailable", "Billing Portal is unavailable.", 503);
  }
}
