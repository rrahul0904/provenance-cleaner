import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { developerApiKeyHash } from "../src/lib/developer-api";
import { resetRateLimitsForTests } from "../src/lib/server/rate-limit";
import { prepareProtectedText } from "../src/lib/transform";

const backend = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), signInAnonymously: vi.fn(), rpc: vi.fn(),
  verifyTurnstile: vi.fn(), generateText: vi.fn(),
}));
const billing = vi.hoisted(() => ({
  initializeCreditAccount: vi.fn(), grantGuestPromoCredits: vi.fn(),
  reserveCredits: vi.fn(), commitReservation: vi.fn(), releaseReservation: vi.fn(),
  completeCheckoutPurchase: vi.fn(), expireCheckoutPurchase: vi.fn(),
  grantSubscriptionInvoice: vi.fn(), linkStripeCustomer: vi.fn(),
  recordCheckoutAmount: vi.fn(), recordPolicyRefund: vi.fn(),
  recordSubscriptionInvoiceAmount: vi.fn(), upsertSubscription: vi.fn(),
}));
vi.mock("../src/lib/supabase/server", async (original) => ({
  ...await original<typeof import("../src/lib/supabase/server")>(), createClient: backend.createClient,
}));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: backend.rpc }) }));
vi.mock("../src/lib/abuse/turnstile", () => ({ verifyTurnstile: backend.verifyTurnstile }));
vi.mock("../src/lib/billing/server", () => billing);
vi.mock("../src/lib/billing/stripe", () => ({ getStripe: () => new Stripe("sk_test_security_fixture") }));
vi.mock("ai", () => ({ generateText: backend.generateText }));

const ORIGIN = "https://app.example";
const USER = "00000000-0000-4000-8000-000000000222";
const KEY = `pc_sk_${"a".repeat(43)}`;
const balance = { settled: 2, held: 0, available: 2 };

async function anonymous(headers: Record<string, string>) {
  const { POST } = await import("../src/app/api/auth/anonymous/route");
  return POST(new Request(`${ORIGIN}/api/auth/anonymous`, { method: "POST", headers, body: "{}" }));
}
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: { code } });
  expect(response.headers.get("cache-control")).toBe("no-store");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  backend.createClient.mockResolvedValue({ auth: { getUser: backend.getUser, signInAnonymously: backend.signInAnonymously } });
  backend.getUser.mockResolvedValue({ data: { user: null } });
  backend.signInAnonymously.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  backend.verifyTurnstile.mockResolvedValue({ ok: true });
  backend.rpc.mockResolvedValue({ data: { userId: USER, keyId: "key_test", prefix: KEY.slice(0, 17) }, error: null });
  billing.initializeCreditAccount.mockResolvedValue(balance);
  billing.reserveCredits.mockResolvedValue({ reservationId: "reserve_test", created: true, status: "reserved" });
  billing.commitReservation.mockResolvedValue(balance);
  billing.completeCheckoutPurchase.mockResolvedValue({ duplicate: false, requires_refund: false });
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_security_fixture");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("cookie mutation security through the actual route", () => {
  it.each([
    { origin: "https://attacker.invalid", "content-type": "application/json" },
    { origin: "https://attacker.invalid", "content-type": "text/plain" },
    { origin: ORIGIN, "sec-fetch-site": "cross-site", "content-type": "application/json" },
    { "sec-fetch-site": "cross-site", "content-type": "application/json" },
    { origin: "null", "content-type": "application/json" },
  ])("rejects cross-site mutation before auth and billing: %j", async (headers) => {
    await expectError(await anonymous(headers), 403, "cross_site_request_blocked");
    expect(backend.verifyTurnstile).not.toHaveBeenCalled();
    expect(backend.createClient).not.toHaveBeenCalled();
    expect(billing.initializeCreditAccount).not.toHaveBeenCalled();
  });

  it("rejects unsupported media on a same-origin request with 415", async () => {
    await expectError(await anonymous({ origin: ORIGIN, "sec-fetch-site": "same-origin", "content-type": "text/plain" }), 415, "unsupported_media_type");
    expect(backend.createClient).not.toHaveBeenCalled();
  });

  it("allows a legitimate same-origin guest session and preserves no-store", async () => {
    const response = await anonymous({ origin: ORIGIN, "sec-fetch-site": "same-origin", "content-type": "application/json" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ userId: USER, isAnonymous: true, balance });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.verifyTurnstile).toHaveBeenCalledWith(undefined, "account");
    expect(backend.signInAnonymously).toHaveBeenCalledOnce();
    expect(billing.initializeCreditAccount).toHaveBeenCalledWith(USER);
  });
});

describe("Bearer and extension API compatibility with real token parsing", () => {
  it.each(["https://client.example", "chrome-extension://abcdefghijklmnop"])("allows authenticated developer scans from %s", async (origin) => {
    const { POST } = await import("../src/app/api/v1/scan/route");
    const response = await POST(new Request(`${ORIGIN}/api/v1/scan`, {
      method: "POST", headers: { origin, "sec-fetch-site": "cross-site", authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ text: "A hidden\u200B marker.", sanitize: "conservative" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ receipt: { summary: { total: 1 } }, sanitation: { output: "A hidden marker." } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.rpc).toHaveBeenCalledWith("developer_api_key_resolve", { p_hash: developerApiKeyHash(KEY) });
  });

  it("allows the extension transform flow while retaining protected facts and billing", async () => {
    const source = "We launched on 2026-08-31 at https://example.com with 42 users.";
    const prepared = prepareProtectedText(source);
    const token = (kind: string) => prepared.spans.find(span => span.kind === kind)!.token;
    backend.generateText.mockResolvedValue({ text: `We released the service on ${token("date")} through ${token("url")} with ${token("number")} users.` });
    const { POST } = await import("../src/app/api/v1/transform/route");
    const response = await POST(new Request(`${ORIGIN}/api/v1/transform`, {
      method: "POST", headers: { origin: "chrome-extension://abcdefghijklmnop", "sec-fetch-site": "cross-site", authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ text: source, mode: "natural", operationId: "00000000-0000-4000-8000-000000000123" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ text: "We released the service on 2026-08-31 through https://example.com with 42 users.", billing: { creditsCharged: 1 } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(billing.reserveCredits).toHaveBeenCalledOnce();
    expect(billing.commitReservation).toHaveBeenCalledWith(USER, "reserve_test");
    expect(billing.releaseReservation).not.toHaveBeenCalled();
  });

  it.each([undefined, "Bearer invalid", `Bearer ${KEY}`])("rejects missing, malformed, or revoked tokens even with session cookies: %s", async (authorization) => {
    backend.rpc.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("../src/app/api/v1/scan/route");
    const response = await POST(new Request(`${ORIGIN}/api/v1/scan`, {
      method: "POST", headers: { origin: "chrome-extension://abcdefghijklmnop", cookie: "sb-session=fake", "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ text: "ordinary text" }),
    }));
    await expectError(response, 401, "invalid_api_key");
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(billing.reserveCredits).not.toHaveBeenCalled();
  });
});

describe("signature-authenticated Stripe callback compatibility", () => {
  const raw = JSON.stringify({ id: "evt_test_security", type: "checkout.session.completed", data: { object: {
    id: "cs_test_security", mode: "payment", payment_status: "paid", amount_total: 499, currency: "usd",
    metadata: { purchase_id: "purchase_test" }, customer_details: { address: { country: "US" } },
  } } }, null, 2);
  const stripe = new Stripe("sk_test_security_fixture");
  async function send(body = raw) {
    const { POST } = await import("../src/app/api/billing/webhook/route");
    const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_security_fixture" });
    return POST(new Request(`${ORIGIN}/api/billing/webhook`, { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body }));
  }
  it("accepts a server callback without browser headers using the unmodified signed body", async () => {
    const response = await send();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(billing.completeCheckoutPurchase).toHaveBeenCalledWith("evt_test_security", "checkout.session.completed", "purchase_test", "cs_test_security");
    expect(billing.recordCheckoutAmount).toHaveBeenCalledWith({ purchaseId: "purchase_test", sessionId: "cs_test_security", amount: 499, currency: "usd" });
  });
  it("rejects body tampering before economic mutation", async () => {
    await expectError(await send(raw.replace("499", "599")), 400, "invalid_webhook_signature");
    expect(billing.completeCheckoutPurchase).not.toHaveBeenCalled();
    expect(billing.recordCheckoutAmount).not.toHaveBeenCalled();
  });
});
