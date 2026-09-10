import { readFileSync } from "node:fs";

const required = [
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "SUPABASE_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PLUS",
  "STRIPE_PRICE_PRO",
  "STRIPE_SUBSCRIPTION_PRICE_PLUS",
  "STRIPE_SUBSCRIPTION_PRICE_PRO",
  "STRIPE_SUBSCRIPTION_PRICE_STUDIO",
  "PROMO_FINGERPRINT_SECRET",
  "CRON_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "RATE_LIMIT_HASH_SALT",
];
const price = new Set([
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PLUS",
  "STRIPE_PRICE_PRO",
  "STRIPE_SUBSCRIPTION_PRICE_PLUS",
  "STRIPE_SUBSCRIPTION_PRICE_PRO",
  "STRIPE_SUBSCRIPTION_PRICE_STUDIO",
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const placeholderEmail = /(^|@)(example\.(com|invalid|org)|invalid|localhost)$|placeholder/iu;
const validOperationalEmail = (value) => emailPattern.test(value) && !placeholderEmail.test(value);
const validUuid = (value) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(value);
const publicConfig = readFileSync("src/lib/public-config.ts", "utf8");
const committedSupabaseUrl = publicConfig.includes('const DEFAULT_SUPABASE_URL = "https://cikxzxxreryycfjumwsd.supabase.co"');
const committedSupabaseKey = publicConfig.includes('const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Jsa3NElnKfCPiXMes-CrXg_hthFy4r1"');

let failed = false;
for (const key of required) {
  const value = process.env[key]?.trim() ?? "";
  const valid =
    Boolean(value)
    && (!price.has(key) || /^price_/u.test(value))
    && (key !== "STRIPE_SECRET_KEY" || /^(sk|rk)_test_/u.test(value))
    && (key !== "PROMO_FINGERPRINT_SECRET" || value.length >= 32)
    && (key !== "NEXT_PUBLIC_SUPPORT_EMAIL" || validOperationalEmail(value));
  console.log(`${valid ? "configured" : "missing_or_invalid"} ${key}`);
  failed ||= !valid;
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim() || "";
const appOriginValid = appUrl ? /^https:\/\//u.test(appUrl) : Boolean(vercelHost);
console.log(`${appOriginValid ? (appUrl ? "configured" : "derived_from_vercel") : "missing_or_invalid"} APP_ORIGIN`);
failed ||= !appOriginValid;

const publicSupabaseValid =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || committedSupabaseUrl)
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || committedSupabaseKey);
console.log(`${publicSupabaseValid ? "configured_or_committed_fallback" : "missing_or_invalid"} SUPABASE_PUBLIC_CONFIG`);
failed ||= !publicSupabaseValid;

const ownerId = process.env.ADMIN_OWNER_USER_ID?.trim() ?? "";
const ownerEmail = process.env.ADMIN_OWNER_EMAIL?.trim() ?? "";
const ownerProvided = Boolean(ownerId || ownerEmail);
const ownerValid = !ownerProvided || (ownerId ? validUuid(ownerId) : validOperationalEmail(ownerEmail));
console.log(`${ownerValid ? (ownerProvided ? "configured" : "optional_runtime_check") : "invalid"} ADMIN_OWNER_BOOTSTRAP`);
failed ||= !ownerValid;

if (failed) process.exit(1);
