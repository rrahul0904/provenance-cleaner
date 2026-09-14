import { describe, expect, it } from "vitest";
import {
  assessReleaseIntegrity,
  normalizeCommitSha,
  normalizeOrigin,
} from "../scripts/lib/release-integrity.mjs";

const SHA = "87bb548134cc3be0f591744d07a0a6a9b4136080";

describe("release integrity", () => {
  it("accepts an exact SHA with healthy ready responses", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      health: { status: "ok", commitSha: SHA },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.actualSha).toBe(SHA);
  });

  it("rejects a deployment that omits commitSha", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      health: { status: "ok", commitSha: null },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("deployed health response is missing commitSha");
  });

  it("rejects a stale deployment SHA", () => {
    const stale = "9f402bb990dbbe329934113ac04bc2f2b1b903c3";
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      health: { status: "ok", commitSha: stale },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.actualSha).toBe(stale);
    expect(result.issues.some((issue: string) => issue.includes("does not match expected SHA"))).toBe(true);
  });

  it("rejects readiness failures even when SHA matches", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      health: { status: "ok", commitSha: SHA },
      readiness: { status: "not_ready", missing: ["cron", "phase8Schema"] },
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["cron", "phase8Schema"]);
    expect(result.issues).toContain("readiness status is not_ready");
  });

  it("normalizes origins and commit SHAs deterministically", () => {
    expect(normalizeOrigin("https://provenance-cleaner.vercel.app/path?q=1")).toBe(
      "https://provenance-cleaner.vercel.app",
    );
    expect(normalizeCommitSha(SHA.toUpperCase())).toBe(SHA);
  });
});
