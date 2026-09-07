import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("Stripe TEST secret is required to configure the Billing Portal.");
  process.exit(1);
}

const stripe = new Stripe(key);
const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://provenance-cleaner.vercel.app").replace(/\/$/u, "");

const products = [
  { product: "prod_VCB2tP5l503QnH", prices: ["price_1UBmgJRB8OGmEnBwoUtRmBKb"] },
  { product: "prod_VCB39KCTnCX2jw", prices: ["price_1UBmhIRB8OGmEnBwFEJNV4zF"] },
  { product: "prod_VCB42rmrFmdB6K", prices: ["price_1UBmiARB8OGmEnBwgoMzZqbw"] },
];

const desired = {
  name: "Provenance Cleaner TEST",
  default_return_url: `${appUrl}/account`,
  business_profile: {
    headline: "Manage your Provenance Cleaner TEST subscription.",
    privacy_policy_url: `${appUrl}/privacy-policy`,
    terms_of_service_url: `${appUrl}/terms-of-service`,
  },
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "none",
      products,
    },
  },
  metadata: { app: "provenance-cleaner", environment: "test" },
};

const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
const owned = existing.data.find(config => config.metadata?.app === "provenance-cleaner" && config.metadata?.environment === "test");
const config = owned
  ? await stripe.billingPortal.configurations.update(owned.id, desired)
  : await stripe.billingPortal.configurations.create(desired);

if (config.livemode) {
  console.error("Refusing a live-mode Billing Portal configuration.");
  process.exit(1);
}

console.log(`Stripe TEST Billing Portal configuration ready: ${config.id}`);
