import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const billing = vi.hoisted(() => ({
  completeCheckoutPurchase: vi.fn(),
  expireCheckoutPurchase: vi.fn(),
  recordPolicyRefund: vi.fn(),
  getRefundQuote: vi.fn(),
  recordPurchaseRefund: vi.fn(),
}));
const identity = vi.hoisted(() => ({ getRequestIdentity: vi.fn() }));
const stripeFns = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSession: vi.fn(),
  createRefund: vi.fn(),
}));
const logs = vi.hoisted(() => ({ logEvent: vi.fn(), requestSubjectKey: vi.fn(() => "subject-hash") }));

vi.mock("../src/lib/billing/server", () => billing);
vi.mock("../src/lib/auth/identity", () => identity);
vi.mock("../src/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: stripeFns.constructEvent },
    checkout: { sessions: { retrieve: stripeFns.retrieveSession } },
    refunds: { create: stripeFns.createRefund },
  }),
}));
vi.mock("../src/lib/server/observability", () => logs);

const PURCHASE_ID = "00000000-0000-4000-8000-000000000111";
const USER_ID = "00000000-0000-4000-8000-000000000222";
const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function checkoutEvent(country: string | null, id = "evt_test_1") {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_policy",
        payment_status: "paid",
        amount_total: 499,
        currency: "usd",
        payment_intent: "pi_test_policy",
        metadata: { purchase_id: PURCHASE_ID },
        client_reference_id: PURCHASE_ID,
        collected_information: { shipping_details: { address: { country } } },
        customer_details: { address: { country } },
      },
    },
  };
}

async function webhookPost() {
  const { POST } = await import("../src/app/api/billing/webhook/route");
  return POST(new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test", "content-type": "application/json" },
    body: "{}",
  }));
}

async function refundPost(purchaseId = PURCHASE_ID) {
  const { POST } = await import("../src/app/api/account/refund/route");
  return POST(new Request("http://localhost/api/account/refund", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purchaseId }),
  }));
}

describe("Stripe TEST reconciliation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_only";
    identity.getRequestIdentity.mockResolvedValue({ userId: USER_ID, isAnonymous: false });
    stripeFns.createRefund.mockResolvedValue({ id: "re_test_1", amount: 499, currency: "usd" });
    stripeFns.retrieveSession.mockResolvedValue({ id: "cs_test_customer", amount_total: 499, currency: "usd", payment_intent: "pi_test_customer" });
    billing.recordPolicyRefund.mockResolvedValue({ refunded: true });
    billing.recordPurchaseRefund.mockResolvedValue({ settled: 0, held: 0, available: 0 });
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    vi.resetModules();
  });

  it("refunds a paid non-US Checkout instead of granting credits", async () => {
    stripeFns.constructEvent.mockReturnValue(checkoutEvent("CA"));
    const response = await webhookPost();
    expect(response.status).toBe(200);
    expect(billing.completeCheckoutPurchase).not.toHaveBeenCalled();
    expect(stripeFns.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_test_policy", amount: 499, metadata: { purchase_id: PURCHASE_ID, policy_reason: "country_policy" } }),
      { idempotencyKey: "policy-refund:country_policy:cs_test_policy" },
    );
    expect(billing.recordPolicyRefund).toHaveBeenCalledWith(expect.objectContaining({ purchaseId: PURCHASE_ID, refundId: "re_test_1", reason: "country_policy", amount: 499, currency: "usd" }));
    expect(await response.json()).toMatchObject({ credited: false, refunded: true, reason: "country_not_supported" });
  });

  it("refunds a paid Checkout when billing reports that the account was deleted", async () => {
    stripeFns.constructEvent.mockReturnValue(checkoutEvent("US"));
    billing.completeCheckoutPurchase.mockResolvedValue({ requires_refund: true, refund_reason: "account_deleted", credits_granted: 0 });
    const response = await webhookPost();
    expect(response.status).toBe(200);
    expect(stripeFns.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_test_policy", amount: 499, metadata: { purchase_id: PURCHASE_ID, policy_reason: "account_deleted" } }),
      { idempotencyKey: "policy-refund:account_deleted:cs_test_policy" },
    );
    expect(billing.recordPolicyRefund).toHaveBeenCalledWith(expect.objectContaining({ reason: "account_deleted" }));
  });

  it("uses the same policy-refund idempotency key when a webhook is retried after DB reconciliation failure", async () => {
    stripeFns.constructEvent.mockReturnValue(checkoutEvent("CA", "evt_retry"));
    billing.recordPolicyRefund.mockRejectedValueOnce(new Error("temporary db failure")).mockResolvedValueOnce({ refunded: true });
    const first = await webhookPost();
    expect(first.status).toBe(500);
    const second = await webhookPost();
    expect(second.status).toBe(200);
    expect(stripeFns.createRefund).toHaveBeenCalledTimes(2);
    const firstOptions = stripeFns.createRefund.mock.calls[0][1];
    const secondOptions = stripeFns.createRefund.mock.calls[1][1];
    expect(firstOptions).toEqual({ idempotencyKey: "policy-refund:country_policy:cs_test_policy" });
    expect(secondOptions).toEqual(firstOptions);
  });

  it("rejects a bad Stripe signature before any economic mutation", async () => {
    stripeFns.constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    const response = await webhookPost();
    expect(response.status).toBe(400);
    expect(stripeFns.createRefund).not.toHaveBeenCalled();
    expect(billing.completeCheckoutPurchase).not.toHaveBeenCalled();
    expect(billing.recordPolicyRefund).not.toHaveBeenCalled();
  });

  it("creates a proportional refund for only the unused credits in one purchase lot", async () => {
    billing.getRefundQuote.mockResolvedValue({ eligible: true, refundableCredits: 7, totalCredits: 10, stripeSessionId: "cs_test_customer", withinWindow: true, alreadyRefunded: false });
    stripeFns.createRefund.mockResolvedValue({ id: "re_test_partial", amount: 349, currency: "usd" });
    const response = await refundPost();
    expect(response.status).toBe(200);
    expect(stripeFns.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_test_customer", amount: 349, metadata: { purchase_id: PURCHASE_ID, credits_refunded: "7" } }),
      { idempotencyKey: `purchase-refund:${PURCHASE_ID}:7` },
    );
    expect(billing.recordPurchaseRefund).toHaveBeenCalledWith({ userId: USER_ID, purchaseId: PURCHASE_ID, refundId: "re_test_partial", credits: 7, amount: 349, currency: "usd" });
  });

  it("reconciles an already-recorded refund without calling Stripe again", async () => {
    billing.getRefundQuote.mockResolvedValue({ alreadyRefunded: true, refund: { refundId: "re_test_existing", credits: 7, amount: 349, currency: "usd", reason: "customer" } });
    const response = await refundPost();
    expect(response.status).toBe(200);
    expect(stripeFns.retrieveSession).not.toHaveBeenCalled();
    expect(stripeFns.createRefund).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ refunded: true, reconciled: true, creditsRefunded: 7, amountRefunded: 349, currency: "usd" });
  });

  it("does not let an anonymous guest request a customer refund", async () => {
    identity.getRequestIdentity.mockResolvedValue({ userId: USER_ID, isAnonymous: true });
    const response = await refundPost();
    expect(response.status).toBe(401);
    expect(billing.getRefundQuote).not.toHaveBeenCalled();
    expect(stripeFns.createRefund).not.toHaveBeenCalled();
  });
});
