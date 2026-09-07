export const SUBSCRIPTION_PLANS = {
  plus_monthly: { id: "plus_monthly", label: "Plus", monthlyCents: 999, credits: 30, env: "STRIPE_SUBSCRIPTION_PRICE_PLUS" },
  pro_monthly: { id: "pro_monthly", label: "Pro", monthlyCents: 2499, credits: 120, env: "STRIPE_SUBSCRIPTION_PRICE_PRO" },
  studio_monthly: { id: "studio_monthly", label: "Studio", monthlyCents: 4999, credits: 300, env: "STRIPE_SUBSCRIPTION_PRICE_STUDIO" },
} as const;
export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

export const CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS: Record<SubscriptionPlanId, string> = {
  plus_monthly: "price_1UBmgJRB8OGmEnBwoUtRmBKb",
  pro_monthly: "price_1UBmhIRB8OGmEnBwFEJNV4zF",
  studio_monthly: "price_1UBmiARB8OGmEnBwgoMzZqbw",
};

export function getSubscriptionPlan(id: SubscriptionPlanId) {
  const plan = SUBSCRIPTION_PLANS[id];
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const configured = process.env[plan.env]?.trim() ?? "";
  const priceId = configured || ((stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_")) ? CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS[id] : "");
  if (!/^price_/u.test(priceId)) throw new Error(`subscription_price_missing:${plan.env}`);
  return { ...plan, priceId };
}
export function subscriptionPlanByPrice(priceId: string) {
  return (Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[]).find(id => {
    try { return getSubscriptionPlan(id).priceId === priceId; } catch { return false; }
  }) ?? null;
}
