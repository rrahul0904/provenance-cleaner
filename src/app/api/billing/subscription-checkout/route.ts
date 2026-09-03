import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/identity";
import { getSubscriptionPlan, type SubscriptionPlanId } from "@/lib/billing/subscriptions";
import { getStripe } from "@/lib/billing/stripe";
import { apiError, apiOk, parseJson, requestContext } from "@/lib/server/api";
import { publicAppOrigin } from "@/lib/server/env";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";
import { requestSubjectKey } from "@/lib/server/observability";

export const runtime = "nodejs";
const schema = z.object({ planId: z.enum(["plus_monthly", "pro_monthly", "studio_monthly"]), challengeToken: z.string().max(2048).optional() });

export async function POST(request: Request) {
  const context = requestContext(request, "/api/billing/subscription-checkout");
  try {
    const identity = await getRequestIdentity();
    if (!identity || identity.isAnonymous) return apiError(context, "registered_account_required", "Sign in with a registered account before starting a monthly plan.", 401);
    const limit = consumeRateLimit("subscription-checkout", requestSubjectKey(request, identity.userId), configuredLimit("RATE_LIMIT_CHECKOUT_PER_MINUTE", 4), 60_000);
    if (!limit.allowed) return apiError(context, "rate_limited", "Too many checkout requests. Try again shortly.", 429);
    const { planId } = await parseJson(request, schema, 4_096);
    const plan = getSubscriptionPlan(planId as SubscriptionPlanId);
    const origin = publicAppOrigin(request);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      client_reference_id: identity.userId,
      customer_creation: "always",
      metadata: { subscription_plan_id: plan.id, user_id: identity.userId },
      subscription_data: { metadata: { subscription_plan_id: plan.id, user_id: identity.userId } },
      success_url: `${origin}/account?subscription=success`,
      cancel_url: `${origin}/pricing?subscription=cancelled`,
    }, { idempotencyKey: `subscription-checkout:${identity.userId}:${plan.id}` });
    if (!session.url) throw new Error("missing_checkout_url");
    return apiOk(context, { url: session.url, plan: { id: plan.id, credits: plan.credits, monthlyCents: plan.monthlyCents, testMode: true } });
  } catch {
    return apiError(context, "subscription_checkout_unavailable", "Monthly checkout is not available.", 503);
  }
}
