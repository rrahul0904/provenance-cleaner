import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  version: string;
  packages: Record<string, { version?: string }>;
};
const health = readFileSync("src/app/api/health/route.ts", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const readinessWorkflow = readFileSync(".github/workflows/deployment-readiness.yml", "utf8");
const deployWorkflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
const integrityWorkflow = readFileSync(".github/workflows/production-integrity.yml", "utf8");
const releaseGate = readFileSync("scripts/release-gate.mjs", "utf8");
const runbook = readFileSync("docs/PRODUCTION_RUNBOOK.md", "utf8");
const security = readFileSync("docs/SECURITY_CHECKLIST.md", "utf8");
const sourceManifestScript = readFileSync("scripts/source-manifest.mjs", "utf8");
const sourceManifest = JSON.parse(readFileSync("release/source-manifest.json", "utf8")) as {
  schemaVersion: number;
  releaseId: string;
  sourceHash: string;
};

describe("release metadata and operator contract", () => {
  it("keeps package and lockfile release versions aligned", () => {
    expect(pkg.version).toBe("0.6.0");
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""]?.version).toBe(pkg.version);
  });

  it("pins certification and production tooling to the Vercel Node 24 runtime", () => {
    expect((pkg as { engines?: { node?: string } }).engines?.node).toBe("24.x");
    expect(lock.packages[""]?.version).toBe(pkg.version);
    for (const workflow of [ci, readinessWorkflow, deployWorkflow, integrityWorkflow]) {
      expect(workflow).toContain("node-version: 24.x");
      expect(workflow).not.toContain("node-version: 22.22.0");
    }
    for (const workflow of [ci, readinessWorkflow]) {
      expect(workflow).toContain("cancel-in-progress: true");
      expect(workflow).toContain("github.event.pull_request.number || github.ref");
    }
    expect(releaseGate).toContain('add("Node 24.x"');
  });

  it("reports Phase 9 health and derives the application version from package metadata", () => {
    expect(health).toContain("version: packageJson.version");
    expect(health).toContain("phase: 9");
    expect(health).toContain("nodeVersion: process.versions.node");
    expect(health).toContain("sourceHash: sourceManifest.sourceHash");
    expect(health).toContain("releaseId: sourceManifest.releaseId");
    expect(health).not.toContain('version: "0.5.1"');
    expect(health).not.toContain("phase: 8");
  });

  it("documents both certified production deployment paths", () => {
    expect(runbook).toContain("production-release");
    expect(runbook).toContain("VERCEL_TOKEN");
    expect(runbook).toContain("OAuth direct-file deployment");
    expect(runbook).toContain("sourceHash");
    expect(runbook).toContain("20260915032600");
  });

  it("commits a deterministic source-manifest contract", () => {
    expect(sourceManifest.schemaVersion).toBe(1);
    expect(sourceManifest.releaseId).toMatch(/^pc-/u);
    expect(sourceManifest.sourceHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(sourceManifestScript).toContain('git", ["ls-files", "-s"]');
    expect(sourceManifestScript).toContain('path !== SOURCE_MANIFEST_PATH');
  });

  it("keeps unresolved external hardening visible instead of marking it complete", () => {
    expect(security).toContain("[ ] Enable Supabase Auth leaked-password protection");
    expect(security).toContain("GitHub Actions `VERCEL_TOKEN`");
    expect(security).toContain("OAuth source-fingerprint deployment");
    expect(security).toContain("[ ] Enable GitHub branch protection/rulesets for `main`");
    expect(security).toContain("[x] Supabase migrations through Phase 9 applied and independently verified");
  });
});
