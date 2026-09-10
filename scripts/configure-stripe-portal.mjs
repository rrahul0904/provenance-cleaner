import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("Stripe TEST secret is required to configure the Billing Portal.");
  process.exit(1);
}

const stripe = new Stripe(key);
const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://provenance-cleaner.vercel.app").replace(/\/$/u, "");

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
    // Plan switching remains intentionally disabled. The app currently guarantees
    // invoice-authoritative monthly grants for the plan selected at Checkout; a
    // separate plan-change workflow would need its own entitlement transition tests.
    subscription_update: { enabled: false },
  },
  metadata: { app: "provenance-cleaner", environment: "test" },
};

const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
const owned = existing.data.find((config) => config.metadata?.app === "provenance-cleaner" && config.metadata?.environment === "test");
const config = owned
  ? await stripe.billingPortal.configurations.update(owned.id, desired)
  : await stripe.billingPortal.configurations.create(desired);

if (config.livemode) {
  console.error("Refusing a live-mode Billing Portal configuration.");
  process.exit(1);
}
if (config.features.subscription_update.enabled) {
  console.error("Refusing a Billing Portal configuration that allows plan switching.");
  process.exit(1);
}
if (!config.features.subscription_cancel.enabled || config.features.subscription_cancel.mode !== "at_period_end") {
  console.error("Billing Portal must allow cancellation at period end.");
  process.exit(1);
}

console.log(`Stripe TEST Billing Portal configuration ready: ${config.id}`);
