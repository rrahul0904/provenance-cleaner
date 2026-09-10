const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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

const ownerId = process.env.ADMIN_OWNER_USER_ID?.trim() ?? "";
const ownerEmail = process.env.ADMIN_OWNER_EMAIL?.trim() ?? "";
const ownerValid = (ownerId && validUuid(ownerId)) || (!ownerId && validOperationalEmail(ownerEmail));
console.log(`${ownerValid ? "configured" : "missing_or_invalid"} ADMIN_OWNER_BOOTSTRAP`);
failed ||= !ownerValid;

if (failed) process.exit(1);
