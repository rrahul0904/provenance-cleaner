import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS, subscriptionGrantForPaidLine } from "@/lib/billing/subscriptions";

const phase6=readFileSync("supabase/migrations/20260901184500_phase6_fifo_privacy.sql","utf8");
const hardening=readFileSync("supabase/migrations/20260907054500_phase8_review_hardening.sql","utf8");
const revenue=readFileSync("supabase/migrations/20260909043500_phase8_finops_revenue.sql","utf8");
const accountDelete=readFileSync("src/app/api/account/delete/route.ts","utf8");
const webhook=readFileSync("src/app/api/billing/webhook/route.ts","utf8");
const transform=readFileSync("src/components/transform-workbench.tsx","utf8");
const fileWorkbench=readFileSync("src/components/file-workbench.tsx","utf8");
const readiness=readFileSync("src/app/api/readiness/route.ts","utf8");

const originalStripeKey=process.env.STRIPE_SECRET_KEY;
afterEach(()=>{if(originalStripeKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=originalStripeKey;});

describe("Phase 8 review hardening",()=>{
  it("upgrades legacy refund tables before RPCs can reference reason",()=>{
    expect(phase6).toContain("alter table billing.purchase_refunds add column if not exists reason text");
    expect(phase6.indexOf("add column if not exists reason")).toBeLessThan(phase6.indexOf("billing_record_policy_refund"));
  });

  it("derives a period grant only from a canonical TEST price with quantity one",()=>{
    process.env.STRIPE_SECRET_KEY="sk_test_ci";
    expect(subscriptionGrantForPaidLine(CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS.plus_monthly,1)).toMatchObject({planId:"plus_monthly",quantity:1,credits:30});
    expect(subscriptionGrantForPaidLine(CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS.plus_monthly,2)).toBeNull();
    expect(subscriptionGrantForPaidLine("price_unknown",1)).toBeNull();
  });

  it("makes paid invoice price and quantity authoritative in both webhook and DB",()=>{
    expect(webhook).toContain("invoiceLinePriceId");
    expect(webhook).toContain("invoiceLineQuantity");
    expect(webhook).toContain("subscriptionGrantForPaidLine");
    expect(webhook).toContain("priceId:grant.priceId");
    expect(webhook).toContain("quantity:grant.quantity");
    expect(hardening).toContain("p_quantity<>1");
    expect(hardening).toContain("stripe_price_id=p_price_id");
    expect(hardening).toContain("credits_per_period=p_credits");
    expect(hardening).toMatch(/drop function if exists public\.billing_grant_subscription_invoice/iu);
  });

  it("stores only privacy-safe integer payment evidence for TEST FinOps",()=>{
    expect(revenue).toContain("add column if not exists amount_total bigint");
    expect(revenue).toContain("add column if not exists amount_paid bigint");
    expect(revenue).toContain("billing_record_checkout_amount");
    expect(revenue).toContain("billing_record_subscription_invoice_amount");
    expect(revenue).not.toMatch(/card_number|payment_method_details|raw_text|source_text|filename|file_bytes/iu);
    expect(webhook).toContain("recordCheckoutAmount");
    expect(webhook).toContain("recordSubscriptionInvoiceAmount");
  });

  it("cancels linked recurring billing before deleting the Auth identity",()=>{
    const cancelIndex=accountDelete.indexOf("cancelLinkedSubscriptions(identity.userId)");
    const deleteIndex=accountDelete.indexOf("admin.auth.admin.deleteUser(identity.userId)");
    expect(cancelIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(cancelIndex);
    expect(accountDelete).toContain("stripe.subscriptions.cancel(subscription.id)");
    expect(accountDelete).toContain("markAccountSubscriptionsCanceled(userId)");
    expect(hardening).toContain("p_status='canceled' and v_existing_customer");
    expect(readiness).toContain('REQUIRED_PHASE8_SCHEMA = "20260909043500"');
    expect(readiness).toContain("billing_phase8_status");
    expect(readiness).toContain("phase8Schema");
    expect(readiness).toContain("finopsRevenueEvidence");
  });

  it("prevents billable UI inputs from invalidating a completed in-flight result",()=>{
    expect(transform).toMatch(/aria-pressed=\{mode === item\.id\}[\s\S]*disabled=\{busy\}/u);
    expect(transform).toMatch(/<textarea[\s\S]*disabled=\{busy\}/u);
    expect(fileWorkbench).toContain('type="file" accept={ACCEPT} disabled={busy || c2paBusy}');
  });
});
