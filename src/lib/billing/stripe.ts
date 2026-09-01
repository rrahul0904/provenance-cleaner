import Stripe from "stripe";
let stripeClient: Stripe | null = null;
export function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) throw new Error("Phase 5 accepts Stripe test-mode keys only.");
  stripeClient = new Stripe(key);
  return stripeClient;
}
