import { CREDIT_PACKS, type CreditPackId } from "./catalog";
function positiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
const PRICE_ENV: Record<CreditPackId, string> = { starter: "STRIPE_PRICE_STARTER", plus: "STRIPE_PRICE_PLUS", pro: "STRIPE_PRICE_PRO" };
const CONTROLLED_LAUNCH_TEST_PRICE_IDS: Record<CreditPackId, string> = {
  starter: "price_1UAXO6RB8OGmEnBwqpc4DaLs",
  plus: "price_1UAXOFRB8OGmEnBwlAwgU1GS",
  pro: "price_1UAXOQRB8OGmEnBwANqar75f",
};
function hasTestStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}
export function getBillingLimits() {
  return { requestsPerMinute: positiveInt("BILLING_REQUESTS_PER_MINUTE", 6), creditsPer24h: positiveInt("BILLING_CREDITS_PER_24H", 50), reservationTtlMinutes: Math.max(1, positiveInt("BILLING_RESERVATION_TTL_MINUTES", 10)) };
}
export function getWelcomeCredits() { return positiveInt("WELCOME_CREDITS", 0); }
export function getServerCreditPack(packId: CreditPackId) {
  const pack = CREDIT_PACKS[packId];
  const priceId = process.env[PRICE_ENV[packId]] || (hasTestStripeKey() ? CONTROLLED_LAUNCH_TEST_PRICE_IDS[packId] : undefined);
  if (!priceId) throw new Error(`Stripe price is not configured for ${packId}.`);
  return { ...pack, priceId };
}
