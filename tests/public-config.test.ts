import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("@/lib/public-config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("public deployment configuration", () => {
  it("uses the Turnstile test site key only in a Preview client build", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect((await loadConfig()).getTurnstileSiteKey()).toBe("1x00000000000000000000AA");
  });

  it("never falls back to the Preview test key in Production", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect((await loadConfig()).getTurnstileSiteKey()).toBeUndefined();
  });
});
