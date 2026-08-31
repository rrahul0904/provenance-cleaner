import Stripe from "stripe";
let stripeClient: Stripe | null = null;
export function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripeClient = new Stripe(key);
  return stripeClient;
}
