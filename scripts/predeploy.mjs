const required = [
  "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPPORT_EMAIL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PLUS", "STRIPE_PRICE_PRO",
  "PROMO_FINGERPRINT_SECRET", "CRON_SECRET", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "RATE_LIMIT_HASH_SALT",
];
const price = new Set(["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PLUS", "STRIPE_PRICE_PRO"]);
let failed = false;
for (const key of required) {
  const value = process.env[key]?.trim() ?? "";
  const valid = Boolean(value) && (!price.has(key) || /^price_/u.test(value)) && (key !== "STRIPE_SECRET_KEY" || /^(sk|rk)_test_/u.test(value)) && (key !== "PROMO_FINGERPRINT_SECRET" || value.length >= 32);
  console.log(`${valid ? "configured" : "missing_or_invalid"} ${key}`);
  failed ||= !valid;
}
if (failed) process.exit(1);

const optionalOwner = process.env.ADMIN_OWNER_USER_ID?.trim() ?? "";
if (optionalOwner && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(optionalOwner)) { console.error("invalid ADMIN_OWNER_USER_ID"); process.exit(1); }
