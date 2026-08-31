import { afterEach, describe, expect, it, vi } from "vitest";

describe("Stripe Phase 5 mode guard", () => {
  const original = process.env.STRIPE_SECRET_KEY;
  afterEach(() => { process.env.STRIPE_SECRET_KEY = original; vi.resetModules(); });
  it("rejects live-mode keys", async () => { process.env.STRIPE_SECRET_KEY = "sk_live_example"; vi.resetModules(); const { getStripe } = await import("../src/lib/billing/stripe"); expect(() => getStripe()).toThrow(/test-mode/i); });
  it("accepts a test-mode key without a network call", async () => { process.env.STRIPE_SECRET_KEY = "sk_test_example"; vi.resetModules(); const { getStripe } = await import("../src/lib/billing/stripe"); expect(getStripe()).toBeTruthy(); });
});
