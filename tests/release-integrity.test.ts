import { describe, expect, it } from "vitest";
import {
  assessReleaseIntegrity,
  normalizeCommitSha,
  normalizeOrigin,
  normalizeSourceHash,
} from "../scripts/lib/release-integrity.mjs";

const SHA = "87bb548134cc3be0f591744d07a0a6a9b4136080";
const SOURCE = "7f".repeat(32);

describe("release integrity", () => {
  it("accepts an exact SHA plus source fingerprint with healthy ready responses", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: {
        status: "ok",
        commitSha: SHA,
        sourceHash: SOURCE,
        releaseId: "pc-test",
        nodeVersion: "24.11.0",
      },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.actualSha).toBe(SHA);
    expect(result.actualSourceHash).toBe(SOURCE);
    expect(result.verificationMode).toBe("commit-sha+source-hash");
  });

  it("accepts a source-certified OAuth deployment without Git SHA metadata", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: {
        status: "ok",
        commitSha: null,
        sourceHash: SOURCE,
        releaseId: "pc-test",
        nodeVersion: "24.11.0",
      },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.actualSha).toBeNull();
    expect(result.verificationMode).toBe("source-hash");
  });

  it("rejects a deployment that omits or changes the source fingerprint", () => {
    const missing = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: { status: "ok", commitSha: null, releaseId: "pc-test", nodeVersion: "24.11.0" },
      readiness: { status: "ready", missing: [] },
    });
    expect(missing.ok).toBe(false);
    expect(missing.issues).toContain("deployed health response is missing sourceHash");

    const changed = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: {
        status: "ok",
        commitSha: null,
        sourceHash: "8f".repeat(32),
        releaseId: "pc-test",
        nodeVersion: "24.11.0",
      },
      readiness: { status: "ready", missing: [] },
    });
    expect(changed.ok).toBe(false);
    expect(changed.issues.some((issue: string) => issue.includes("does not match expected source hash"))).toBe(true);
  });

  it("rejects a stale deployment SHA when SHA metadata is present", () => {
    const stale = "9f402bb990dbbe329934113ac04bc2f2b1b903c3";
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: {
        status: "ok",
        commitSha: stale,
        sourceHash: SOURCE,
        releaseId: "pc-test",
        nodeVersion: "24.11.0",
      },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.actualSha).toBe(stale);
    expect(result.issues.some((issue: string) => issue.includes("does not match expected SHA"))).toBe(true);
  });

  it("rejects a deployed runtime outside Node 24", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: {
        status: "ok",
        commitSha: SHA,
        sourceHash: SOURCE,
        releaseId: "pc-test",
        nodeVersion: "22.22.0",
      },
      readiness: { status: "ready", missing: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.nodeVersion).toBe("22.22.0");
    expect(result.issues).toContain("deployed Node.js major 22 does not match required major 24");
  });

  it("rejects readiness failures even when source identity matches", () => {
    const result = assessReleaseIntegrity({
      expectedSha: SHA,
      expectedSourceHash: SOURCE,
      health: {
        status: "ok",
        commitSha: SHA,
        sourceHash: SOURCE,
        releaseId: "pc-test",
        nodeVersion: "24.11.0",
      },
      readiness: { status: "not_ready", missing: ["cron", "phase8Schema"] },
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["cron", "phase8Schema"]);
    expect(result.issues).toContain("readiness status is not_ready");
  });

  it("normalizes origins and release identities deterministically", () => {
    expect(normalizeOrigin("https://provenance-cleaner.vercel.app/path?q=1")).toBe(
      "https://provenance-cleaner.vercel.app",
    );
    expect(normalizeCommitSha(SHA.toUpperCase())).toBe(SHA);
    expect(normalizeSourceHash(SOURCE.toUpperCase())).toBe(SOURCE);
  });
});
