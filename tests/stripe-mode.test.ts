import { afterEach, describe, expect, it, vi } from "vitest";

describe("Stripe Phase 5 mode guard", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalStarter = process.env.STRIPE_PRICE_STARTER;
  const originalPlus = process.env.STRIPE_PRICE_PLUS;
  const originalPro = process.env.STRIPE_PRICE_PRO;

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalKey;
    process.env.STRIPE_PRICE_STARTER = originalStarter;
    process.env.STRIPE_PRICE_PLUS = originalPlus;
    process.env.STRIPE_PRICE_PRO = originalPro;
    vi.resetModules();
  });

  it("rejects live-mode keys", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    vi.resetModules();
    const { getStripe } = await import("../src/lib/billing/stripe");
    expect(() => getStripe()).toThrow(/test-mode/i);
  });

  it("accepts a test-mode key without a network call", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    vi.resetModules();
    const { getStripe } = await import("../src/lib/billing/stripe");
    expect(getStripe()).toBeTruthy();
  });

  it("uses the fixed controlled-launch TEST catalog when explicit price env is absent", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_PLUS;
    delete process.env.STRIPE_PRICE_PRO;
    vi.resetModules();
    const { getServerCreditPack } = await import("../src/lib/billing/config");
    expect(getServerCreditPack("starter").priceId).toBe("price_1UAXO6RB8OGmEnBwqpc4DaLs");
    expect(getServerCreditPack("plus").priceId).toBe("price_1UAXOFRB8OGmEnBwlAwgU1GS");
    expect(getServerCreditPack("pro").priceId).toBe("price_1UAXOQRB8OGmEnBwANqar75f");
  });

  it("does not use the controlled-launch TEST catalog with a live key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    delete process.env.STRIPE_PRICE_STARTER;
    vi.resetModules();
    const { getServerCreditPack } = await import("../src/lib/billing/config");
    expect(() => getServerCreditPack("starter")).toThrow(/not configured/i);
  });
});
