import { describe, expect, it } from "vitest";
import { apiError, apiOk, requestContext } from "../src/lib/server/api";
import { crossSiteMutationReason } from "../src/lib/server/request-security";

describe("launch security boundaries", () => {
  it("blocks cross-site browser mutation requests by Origin", () => {
    const request = new Request("https://app.example/api/account/delete", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(crossSiteMutationReason(request)).toBe("origin_mismatch");
  });

  it("blocks cross-site browser mutation requests by Fetch Metadata", () => {
    const request = new Request("https://app.example/api/account/delete", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(crossSiteMutationReason(request)).toBe("sec_fetch_site_cross_site");
  });

  it("allows same-origin browser mutations and non-browser server calls", () => {
    expect(crossSiteMutationReason(new Request("https://app.example/api/transform", {
      method: "POST",
      headers: { origin: "https://app.example", "sec-fetch-site": "same-origin" },
    }))).toBeNull();

    expect(crossSiteMutationReason(new Request("https://app.example/api/billing/webhook", {
      method: "POST",
    }))).toBeNull();
  });

  it("allows cross-origin developer API calls only when they carry a Bearer credential", () => {
    expect(crossSiteMutationReason(new Request("https://app.example/api/v1/transform", {
      method: "POST",
      headers: {
        origin: "chrome-extension://abcdefghijklmnop",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer pc_live_example",
      },
    }))).toBeNull();

    expect(crossSiteMutationReason(new Request("https://app.example/api/v1/transform", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    }))).toBe("sec_fetch_site_cross_site");

    expect(crossSiteMutationReason(new Request("https://app.example/api/account/delete", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        authorization: "Bearer not-relevant-here",
      },
    }))).toBe("origin_mismatch");
  });

  it("never applies the CSRF mutation guard to safe methods", () => {
    expect(crossSiteMutationReason(new Request("https://app.example/api/health", {
      method: "GET",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    }))).toBeNull();
  });

  it("marks successful and error JSON responses no-store by default", () => {
    const context = requestContext(new Request("https://app.example/api/test"), "/api/test");
    const ok = apiOk(context, { ok: true });
    const error = apiError(context, "denied", "Denied.", 403);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(error.headers.get("cache-control")).toBe("no-store");
  });
});
