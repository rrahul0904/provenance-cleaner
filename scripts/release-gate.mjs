import { existsSync, readFileSync } from "node:fs";

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });

add("Node >= 22.22", (() => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 22);
})(), process.versions.node);

add("package-lock.json committed", existsSync("package-lock.json"), existsSync("package-lock.json") ? "present" : "missing");

const requiredClient = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_SUPPORT_EMAIL"];
const requiredServer = ["SUPABASE_SECRET_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TURNSTILE_SECRET_KEY", "RATE_LIMIT_HASH_SALT", "PROMO_FINGERPRINT_SECRET", "CRON_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PLUS", "STRIPE_PRICE_PRO", "STRIPE_SUBSCRIPTION_PRICE_PLUS", "STRIPE_SUBSCRIPTION_PRICE_PRO", "STRIPE_SUBSCRIPTION_PRICE_STUDIO", "ADMIN_OWNER_USER_ID"];
for (const name of [...requiredClient, ...requiredServer]) add(`env:${name}`, Boolean(process.env[name]), process.env[name] ? "configured" : "missing");
add("PROMO_FINGERPRINT_SECRET length", (process.env.PROMO_FINGERPRINT_SECRET?.length ?? 0) >= 32, process.env.PROMO_FINGERPRINT_SECRET ? "configured" : "missing");
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
const supportEmailConfigured = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(supportEmail) && !/(^|@)(example\.(com|invalid|org)|invalid|localhost)$|placeholder/iu.test(supportEmail);
add("Production support email", supportEmailConfigured, supportEmail ? "configured" : "missing");
for (const name of ["STRIPE_SUBSCRIPTION_PRICE_PLUS", "STRIPE_SUBSCRIPTION_PRICE_PRO", "STRIPE_SUBSCRIPTION_PRICE_STUDIO"]) add(`Stripe TEST subscription price:${name}`, /^price_/u.test(process.env[name] ?? ""), process.env[name] ? "configured" : "missing");
add("Admin owner UUID", /^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(process.env.ADMIN_OWNER_USER_ID ?? ""), process.env.ADMIN_OWNER_USER_ID ? "configured" : "missing");

if (process.env.STRIPE_SECRET_KEY) add("Stripe test mode", process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") || process.env.STRIPE_SECRET_KEY.startsWith("rk_test_"), "live keys are forbidden during controlled launch");
if (process.env.NEXT_PUBLIC_APP_URL) add("HTTPS app URL", /^https:\/\//.test(process.env.NEXT_PUBLIC_APP_URL), process.env.NEXT_PUBLIC_APP_URL);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
add("Pinned dependencies", Object.values({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }).every(v => /^\d+\.\d+\.\d+/.test(v)), "no ranges allowed");

const finalPhase6Migration = "supabase/migrations/20260902034500_phase6_deletion_recovery.sql";
const phase7Migration = "supabase/migrations/20260903144643_phase7_admin_finops_subscriptions.sql";
add("Final Phase 6 recovery migration committed", existsSync(finalPhase6Migration), finalPhase6Migration);
if (existsSync(finalPhase6Migration)) {
  const migration = readFileSync(finalPhase6Migration, "utf8");
  add("Phase 6 recovery schema version", migration.includes("'schemaVersion', '20260902034500'"), "20260902034500");
  add("Phase 6 stale deletion recovery", migration.includes("deletion_requested_at <= now() - interval '10 minutes'"), "failed prepare/cancel paths recover automatically");
}
add("Phase 7 control-plane migration committed", existsSync(phase7Migration), phase7Migration);
if (existsSync(phase7Migration)) {
  const migration = readFileSync(phase7Migration, "utf8");
  add("Phase 7 private ops schema", migration.includes("create schema if not exists ops"), "ops schema");
  add("Phase 7 admin RBAC", migration.includes("ops.admin_users") && migration.includes("'owner', 'admin', 'viewer'"), "server-controlled roles");
  add("Phase 7 subscription grants", migration.includes("billing.subscription_period_grants") && migration.includes("subscription_invoice:"), "idempotent invoice grants");
}
const readinessPath = "src/app/api/readiness/route.ts";
if (existsSync(readinessPath)) {
  const readiness = readFileSync(readinessPath, "utf8");
  add("Readiness requires final Phase 6", readiness.includes('REQUIRED_PHASE6_SCHEMA = "20260902034500"'), "exact database schema required");
} else {
  add("Readiness requires final Phase 6", false, "readiness route missing");
}

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name} — ${item.detail}`);
const failed = checks.filter(item => !item.ok);
if (failed.length) {
  console.error(`\nControlled-launch gate failed: ${failed.length} check(s).`);
  process.exit(1);
}
console.log("\nControlled-launch static gate passed. Runtime, DB, CI and preview verification are still required.");
