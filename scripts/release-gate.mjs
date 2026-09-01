import { existsSync, readFileSync } from "node:fs";

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });

add("Node >= 22.22", (() => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 22);
})(), process.versions.node);

add("package-lock.json committed", existsSync("package-lock.json"), existsSync("package-lock.json") ? "present" : "missing");

const requiredClient = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"];
const requiredServer = ["SUPABASE_SECRET_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TURNSTILE_SECRET_KEY", "RATE_LIMIT_HASH_SALT", "CRON_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PLUS", "STRIPE_PRICE_PRO"];
for (const name of [...requiredClient, ...requiredServer]) add(`env:${name}`, Boolean(process.env[name]), process.env[name] ? "configured" : "missing");

if (process.env.STRIPE_SECRET_KEY) add("Stripe test mode", process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") || process.env.STRIPE_SECRET_KEY.startsWith("rk_test_"), "live keys are forbidden during controlled launch");
if (process.env.NEXT_PUBLIC_APP_URL) add("HTTPS app URL", /^https:\/\//.test(process.env.NEXT_PUBLIC_APP_URL), process.env.NEXT_PUBLIC_APP_URL);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
add("Pinned dependencies", Object.values({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }).every(v => /^\d+\.\d+\.\d+/.test(v)), "no ranges allowed");

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name} — ${item.detail}`);
const failed = checks.filter(item => !item.ok);
if (failed.length) {
  console.error(`\nControlled-launch gate failed: ${failed.length} check(s).`);
  process.exit(1);
}
console.log("\nControlled-launch static gate passed. Runtime, DB, CI and preview verification are still required.");
