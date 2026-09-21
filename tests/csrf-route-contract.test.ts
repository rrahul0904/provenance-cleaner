import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(process.cwd(), "src", "app", "api");
const MUTATION_EXPORT = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/u;

// These mutation surfaces do not use browser cookie authority:
// - /api/billing/webhook: Stripe signature-authenticated server callback
// - /api/internal/*: CRON_SECRET-authenticated internal jobs
// - /api/v1/*: revocable Bearer API-key clients
// - /api/scan: stateless free inspection, no account/economic mutation
const EXEMPT = new Set([
  "billing/webhook/route.ts",
  "internal/ops-rollup/route.ts",
  "internal/reconcile/route.ts",
  "v1/scan/route.ts",
  "v1/transform/route.ts",
  "scan/route.ts",
]);

function routeFiles(dir = API_ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

describe("cookie-authenticated mutation route CSRF contract", () => {
  it("requires every non-exempt mutating API route to call the route-level guard", () => {
    const missing: string[] = [];

    for (const file of routeFiles()) {
      const source = readFileSync(file, "utf8");
      if (!MUTATION_EXPORT.test(source)) continue;

      const route = relative(API_ROOT, file).replaceAll("\\", "/");
      if (EXEMPT.has(route)) continue;

      if (!source.includes("crossSiteMutationError(request, context)")) missing.push(route);
    }

    expect(missing, `mutating routes missing CSRF enforcement: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps server/Bearer exemptions narrow and explicit", () => {
    for (const route of EXEMPT) {
      expect(readFileSync(join(API_ROOT, route), "utf8").length).toBeGreaterThan(0);
    }
  });
});
