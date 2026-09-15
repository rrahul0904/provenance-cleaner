import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformOperationKey } from "@/lib/billing/operation-key";
import { DEVELOPER_API_KEY_PREFIX, developerApiKeyHash, developerBearerToken, generateDeveloperApiKeyMaterial } from "@/lib/developer-api";

const migration = readFileSync("supabase/migrations/20260914153000_phase9_developer_api.sql", "utf8");
const hardeningMigration = readFileSync("supabase/migrations/20260914155500_phase9_developer_api_concurrency.sql", "utf8");
const accountKeys = readFileSync("src/app/api/account/api-keys/route.ts", "utf8");
const scan = readFileSync("src/app/api/v1/scan/route.ts", "utf8");
const transform = readFileSync("src/app/api/v1/transform/route.ts", "utf8");
const browserTransform = readFileSync("src/app/api/transform/route.ts", "utf8");
const cli = readFileSync("scripts/provenance-cli.mjs", "utf8");
const developerDocs = readFileSync("docs/DEVELOPER_API.md", "utf8");
const readiness = readFileSync("src/app/api/readiness/route.ts", "utf8");

describe("Phase 9 developer API", () => {
  it("generates one-way key material with a stable public prefix", () => {
    const key = generateDeveloperApiKeyMaterial();
    expect(key.secret.startsWith(DEVELOPER_API_KEY_PREFIX)).toBe(true);
    expect(key.prefix).toBe(key.secret.slice(0, 17));
    expect(key.hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(key.hash).toBe(developerApiKeyHash(key.secret));
    expect(key.hash).not.toContain(key.secret);
  });

  it("accepts only the dedicated Bearer-key shape", () => {
    const key = generateDeveloperApiKeyMaterial();
    const request = { headers: new Headers({ authorization: `Bearer ${key.secret}` }) };
    expect(developerBearerToken(request)).toBe(key.secret);
    expect(developerBearerToken({ headers: new Headers({ authorization: "Bearer wrong" }) })).toBeNull();
    expect(developerBearerToken({ headers: new Headers() })).toBeNull();
  });

  it("stores hashes only and keeps browser roles out of the private key table", () => {
    expect(migration).toContain("key_hash text not null unique");
    expect(migration).not.toMatch(/raw_secret|plain_secret|api_secret\s+text/iu);
    expect(migration).toContain("alter table ops.developer_api_keys enable row level security");
    expect(migration).toContain("revoke all on table ops.developer_api_keys from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.developer_api_key_resolve(text) to service_role");
    expect(migration).toContain("coalesce(u.is_anonymous, false) = false");
    expect(migration).toContain("u.email_confirmed_at is not null");
  });

  it("serializes key creation before enforcing the active-key cap", () => {
    expect(hardeningMigration).toContain("for update");
    expect(hardeningMigration).toContain("from auth.users u");
    expect(hardeningMigration).toContain("count(*) from ops.developer_api_keys");
    expect(hardeningMigration.indexOf("for update")).toBeLessThan(hardeningMigration.indexOf("count(*) from ops.developer_api_keys"));
    expect(hardeningMigration).toContain("grant execute on function public.developer_api_key_create(uuid,text,text,text) to service_role");
  });

  it("requires a verified browser identity to manage keys", () => {
    expect(accountKeys).toContain("identity.isAnonymous || !identity.emailVerified");
    expect(accountKeys).toContain("secretShownOnce: true");
    expect(accountKeys).toContain("revokeDeveloperApiKey");
  });

  it("keeps machine scan free while semantic transform uses authoritative credits", () => {
    expect(scan).toContain("authenticateDeveloperRequest");
    expect(scan).not.toContain("reserveCredits");
    expect(transform).toContain("authenticateDeveloperRequest");
    expect(transform).toContain("reserveCredits");
    expect(transform).toContain("commitReservation");
    expect(transform).toContain("releaseReservation");
    expect(transform).not.toContain("verifyTurnstile");
  });

  it("uses one stable operation-id key across browser and developer transforms", () => {
    const operationId = "8E1D8274-F4E9-44BF-98FB-2AA2B8BD2C4A";
    expect(transformOperationKey(operationId)).toBe("transform:8e1d8274-f4e9-44bf-98fb-2aa2b8bd2c4a");
    expect(transform).toContain("transformOperationKey(parsed.operationId)");
    expect(browserTransform).toContain("transformOperationKey(parsed.operationId)");
    expect(transform).not.toContain("wordBucketKey");
    expect(browserTransform).not.toContain("wordBucketKey");
  });

  it("documents and validates only supported semantic transform modes", () => {
    expect(developerDocs).toContain('"mode": "natural"');
    expect(developerDocs).not.toContain('"mode": "sanitize"');
    expect(developerDocs).toContain("`parity`, `natural`, `clarity`, `concise`, or `formal`");
    expect(cli).toContain('new Set(["parity", "natural", "clarity", "concise", "formal"])');
    expect(cli).toContain("!TRANSFORM_MODES.has(mode)");
  });

  it("makes the deployed Phase 9 database contract a required readiness gate", () => {
    expect(readiness).toContain('REQUIRED_PHASE9_SCHEMA = "20260914153000"');
    expect(readiness).toContain("getDeveloperPhase9Status");
    expect(readiness).toContain("phase9Schema");
    expect(readiness).toContain("hashedSecretsOnly");
  });
});
