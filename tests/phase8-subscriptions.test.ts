import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/subscriptions";

const webhook = readFileSync("src/app/api/billing/webhook/route.ts", "utf8");
const checkout = readFileSync("src/app/api/billing/subscription-checkout/route.ts", "utf8");
const pricing = readFileSync("src/app/pricing/page.tsx", "utf8");
const readiness = readFileSync("src/app/api/readiness/route.ts", "utf8");
const portal = readFileSync("src/app/api/billing/portal/route.ts", "utf8");
const portalBootstrap = readFileSync("scripts/configure-stripe-portal.mjs", "utf8");

describe("Phase 8 subscription release regressions", () => {
  it("keeps the recurring catalog aligned to the Stripe TEST products", () => {
    expect(SUBSCRIPTION_PLANS.plus_monthly).toMatchObject({ monthlyCents: 999, credits: 30 });
    expect(SUBSCRIPTION_PLANS.pro_monthly).toMatchObject({ monthlyCents: 2499, credits: 120 });
    expect(SUBSCRIPTION_PLANS.studio_monthly).toMatchObject({ monthlyCents: 4999, credits: 300 });
  });

  it("never treats a subscription Checkout session as a credit-pack purchase", () => {
    expect(webhook).toContain('session.mode==="subscription"?null');
    expect(webhook).toContain('if(session.mode==="subscription")');
    expect(webhook).toContain('return apiOk(context,{received:true,subscription:true})');
  });

  it("does not use customer_creation in subscription mode and verifies the bot challenge", () => {
    expect(checkout).not.toContain("customer_creation");
    expect(checkout).toContain('verifyTurnstile(challengeToken, "account")');
    expect(checkout).toContain("billing_get_stripe_customer");
  });

  it("binds Portal sessions to a TEST configuration with safe cancellation semantics", () => {
    expect(portal).toContain("billingPortal.configurations.list");
    expect(portal).toContain("configuration: configuration.id");
    expect(portalBootstrap).toContain("billingPortal.configurations.create");
    expect(portalBootstrap).toContain('subscription_update: { enabled: false }');
    expect(portalBootstrap).toContain('mode: "at_period_end"');
    expect(portalBootstrap).toContain("Refusing a Billing Portal configuration that allows plan switching.");
  });

  it("exposes an actionable monthly plan UI and requires final database readiness", () => {
    expect(pricing).toContain("SubscriptionPlanGrid");
    expect(readiness).toContain('REQUIRED_PHASE7_SCHEMA = "20260903144643"');
    expect(readiness).toContain("phase7Schema");
    expect(readiness).toContain("ops_admin_status");
    expect(readiness).toContain("adminOwner");
  });
});
