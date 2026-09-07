import { z } from "zod";
import { verifyTurnstile } from "@/lib/abuse/turnstile";
import { getRequestIdentity } from "@/lib/auth/identity";
import { getSubscriptionPlan, type SubscriptionPlanId } from "@/lib/billing/subscriptions";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, parseJson, requestContext, retryAfter } from "@/lib/server/api";
import { publicAppOrigin } from "@/lib/server/env";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";

export const runtime = "nodejs";
const schema = z.object({ planId: z.enum(["plus_monthly", "pro_monthly", "studio_monthly"]), challengeToken: z.string().max(2048).optional() });

function customerIdFrom(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as { stripe_customer_id?: unknown }).stripe_customer_id;
  return typeof id === "string" && /^cus_/u.test(id) ? id : null;
}

export async function POST(request: Request) {
  const context = requestContext(request, "/api/billing/subscription-checkout");
  try {
    const identity = await getRequestIdentity();
    if (!identity || identity.isAnonymous) return apiError(context, "registered_account_required", "Sign in with a registered account before starting a monthly plan.", 401);

    const subject = requestSubjectKey(request, identity.userId);
    const limit = consumeRateLimit("subscription-checkout", subject, configuredLimit("RATE_LIMIT_CHECKOUT_PER_MINUTE", 4), 60_000);
    if (!limit.allowed) return apiError(context, "rate_limited", "Too many checkout requests. Try again shortly.", 429, retryAfter(limit.retryAfterSeconds));

    const { planId, challengeToken } = await parseJson(request, schema, 4_096);
    const challenge = await verifyTurnstile(challengeToken, "account");
    if (!challenge.ok) {
      logEvent("bot_challenge_failed", { requestId: context.requestId, route: context.route, userIdHash: subject, reason: challenge.reason ?? "unknown" });
      return apiError(context, challenge.reason === "not_configured" ? "bot_protection_unavailable" : "bot_challenge_failed", challenge.reason === "not_configured" ? "Bot protection is not configured." : "Bot verification is required.", challenge.reason === "not_configured" ? 503 : 403);
    }

    const plan = getSubscriptionPlan(planId as SubscriptionPlanId);
    const origin = publicAppOrigin(request);
    const { data: linkedCustomer } = await createAdminClient().rpc("billing_get_stripe_customer", { p_user_id: identity.userId });
    const customer = customerIdFrom(linkedCustomer);

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      client_reference_id: identity.userId,
      ...(customer ? { customer } : {}),
      billing_address_collection: "required",
      metadata: { subscription_plan_id: plan.id, user_id: identity.userId },
      subscription_data: { metadata: { subscription_plan_id: plan.id, user_id: identity.userId } },
      success_url: `${origin}/account?subscription=success`,
      cancel_url: `${origin}/pricing?subscription=cancelled`,
    }, { idempotencyKey: `subscription-checkout:${identity.userId}:${plan.id}` });

    if (!session.url) throw new Error("missing_checkout_url");
    logEvent("subscription_checkout_created", { requestId: context.requestId, userIdHash: subject, planId: plan.id, existingCustomer: Boolean(customer) });
    return apiOk(context, { url: session.url, plan: { id: plan.id, credits: plan.credits, monthlyCents: plan.monthlyCents, testMode: true } });
  } catch {
    return apiError(context, "subscription_checkout_unavailable", "Monthly checkout is not available.", 503);
  }
}
