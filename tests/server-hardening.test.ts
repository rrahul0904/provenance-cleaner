import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../src/lib/abuse/turnstile";
import { parseJson, requestContext } from "../src/lib/server/api";
import { logEvent } from "../src/lib/server/observability";
import { consumeRateLimit, resetRateLimitsForTests } from "../src/lib/server/rate-limit";
import { z } from "zod";

describe("Phase 5 server hardening", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY; const originalBypass = process.env.TURNSTILE_DEV_BYPASS;
  beforeEach(() => { resetRateLimitsForTests(); process.env.TURNSTILE_DEV_BYPASS = "0"; });
  afterEach(() => { process.env.TURNSTILE_SECRET_KEY = originalSecret; process.env.TURNSTILE_DEV_BYPASS = originalBypass; vi.restoreAllMocks(); });
  it("rate limits a burst without storing raw identifiers", () => { expect(consumeRateLimit("test", "hash-only", 2, 60_000, 1).allowed).toBe(true); expect(consumeRateLimit("test", "hash-only", 2, 60_000, 2).allowed).toBe(true); const blocked = consumeRateLimit("test", "hash-only", 2, 60_000, 3); expect(blocked.allowed).toBe(false); expect(blocked.retryAfterSeconds).toBeGreaterThan(0); });
  it("validates Turnstile server-side and enforces action", async () => { process.env.TURNSTILE_SECRET_KEY = "test-secret"; const goodFetch = vi.fn(async () => new Response(JSON.stringify({ success: true, action: "transform" }), { status: 200 })); expect(await verifyTurnstile("token", "transform", goodFetch as typeof fetch)).toEqual({ ok: true }); expect(await verifyTurnstile("token", "account", goodFetch as typeof fetch)).toEqual({ ok: false, reason: "action_mismatch" }); });
  it("allows only the explicit non-production Turnstile bypass", async () => { process.env.TURNSTILE_DEV_BYPASS = "1"; expect(await verifyTurnstile("dev-bypass", "transform", vi.fn() as unknown as typeof fetch)).toEqual({ ok: true, bypassed: true }); });
  it("rejects non-json and oversized request bodies", async () => { const schema = z.object({ value: z.string() }); await expect(parseJson(new Request("http://local", { method: "POST", body: "x" }), schema)).rejects.toMatchObject({ status: 415 }); await expect(parseJson(new Request("http://local", { method: "POST", headers: { "content-type": "application/json", "content-length": "5000" }, body: "{}" }), schema, 100)).rejects.toMatchObject({ status: 413 }); });
  it("accepts a safe incoming request id and replaces invalid ids", () => { expect(requestContext(new Request("http://local", { headers: { "x-request-id": "safe_request_123" } }), "/x").requestId).toBe("safe_request_123"); expect(requestContext(new Request("http://local", { headers: { "x-request-id": "bad id" } }), "/x").requestId).not.toBe("bad id"); });
  it("redacts content-like metadata from operational logs", () => { const spy = vi.spyOn(console, "info").mockImplementation(() => undefined); logEvent("test", { rawText: "private prose", token: "secret", sourceChars: 12, userIdHash: "safehash" }); const record = JSON.parse(String(spy.mock.calls[0][0])); expect(record.rawText).toBe("[redacted]"); expect(record.token).toBe("[redacted]"); expect(record.sourceChars).toBe(12); expect(record.userIdHash).toBe("safehash"); });
});
