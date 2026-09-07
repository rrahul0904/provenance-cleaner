export const SUBSCRIPTION_PLANS = {
  plus_monthly: { id: "plus_monthly", label: "Plus Monthly", monthlyCents: 999, credits: 30 },
  pro_monthly: { id: "pro_monthly", label: "Pro Monthly", monthlyCents: 2499, credits: 120 },
  studio_monthly: { id: "studio_monthly", label: "Studio Monthly", monthlyCents: 4999, credits: 300 },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";

const PRICE_ENV: Record<SubscriptionPlanId, string> = {
  plus_monthly: "STRIPE_SUBSCRIPTION_PRICE_PLUS",
  pro_monthly: "STRIPE_SUBSCRIPTION_PRICE_PRO",
  studio_monthly: "STRIPE_SUBSCRIPTION_PRICE_STUDIO",
};

export const CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS: Record<SubscriptionPlanId, string> = {
  plus_monthly: "price_1UBmgJRB8OGmEnBwoUtRmBKb",
  pro_monthly: "price_1UBmhIRB8OGmEnBwFEJNV4zF",
  studio_monthly: "price_1UBmiARB8OGmEnBwgoMzZqbw",
};

function configuredPriceId(planId: SubscriptionPlanId) {
  const configured = process.env[PRICE_ENV[planId]]?.trim();
  if (configured) return configured;
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_")) {
    return CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS[planId];
  }
  return "";
}

export function subscriptionPlanFromPrice(priceId: string | null | undefined): SubscriptionPlanId | null {
  if (!priceId) return null;
  return (Object.keys(PRICE_ENV) as SubscriptionPlanId[]).find((plan) => configuredPriceId(plan) === priceId) ?? null;
}

export function getSubscriptionPlan(planId: SubscriptionPlanId) {
  const priceId = configuredPriceId(planId);
  if (!priceId || !/^price_/u.test(priceId)) throw new Error(`${PRICE_ENV[planId]} is not configured with a Stripe price.`);
  return { ...SUBSCRIPTION_PLANS[planId], priceId };
}

export function isGrantableSubscriptionStatus(status: string): status is "active" | "trialing" {
  return status === "active" || status === "trialing";
}

export function subscriptionInvoiceSourceKey(invoiceId: string) {
  if (!/^in_[A-Za-z0-9]+$/u.test(invoiceId)) throw new Error("Invalid Stripe invoice identifier.");
  return `subscription_invoice:${invoiceId}`;
}

export function subscriptionMonthlyMrrCents(subscriptions: ReadonlyArray<{ status: string; planId: SubscriptionPlanId }>) {
  return subscriptions.filter((subscription) => isGrantableSubscriptionStatus(subscription.status)).reduce((total, subscription) => total + SUBSCRIPTION_PLANS[subscription.planId].monthlyCents, 0);
}
