export type ReadinessCheck = { configured: boolean; required: boolean };
const DEFAULT_SUPABASE_URL = "https://cikxzxxreryycfjumwsd.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Jsa3NElnKfCPiXMes-CrXg_hthFy4r1";
const CONTROLLED_LAUNCH_TEST_PRICE_IDS = ["price_1UAXO6RB8OGmEnBwqpc4DaLs", "price_1UAXOFRB8OGmEnBwlAwgU1GS", "price_1UAXOQRB8OGmEnBwANqar75f"];
const CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS = ["price_1UBmgJRB8OGmEnBwoUtRmBKb", "price_1UBmhIRB8OGmEnBwFEJNV4zF", "price_1UBmiARB8OGmEnBwgoMzZqbw"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PLACEHOLDER_EMAIL = /(^|@)(example\.(com|invalid|org)|invalid|localhost)$|placeholder/iu;

function isVercelPreview() { return process.env.VERCEL_ENV === "preview"; }
function vercelOrigin() {
  const host = isVercelPreview()
    ? (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL)
    : (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL);
  return host ? `https://${host}` : undefined;
}
function hasOidc(request?: Request) {
  return Boolean(process.env.VERCEL_OIDC_TOKEN?.trim() || request?.headers.get("x-vercel-oidc-token")?.trim());
}

function isConfiguredOperationalEmail(value: string | undefined) {
  const email = value?.trim() ?? "";
  return EMAIL_PATTERN.test(email) && !PLACEHOLDER_EMAIL.test(email);
}

export function isDevelopmentTurnstileBypass() { return process.env.NODE_ENV !== "production" && process.env.TURNSTILE_DEV_BYPASS === "1"; }
export function isConfiguredSupportEmail(value: string | undefined) { return isConfiguredOperationalEmail(value); }
export function isConfiguredAdminOwnerEmail(value: string | undefined) { return isConfiguredOperationalEmail(value); }
export function publicAppOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = configured || vercelOrigin();
  if (candidate) {
    const url = new URL(candidate);
    if (!/^https?:$/u.test(url.protocol)) throw new Error("Application URL must use http or https.");
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Application URL must use https in production.");
    return url.origin;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Application URL is required in production.");
  return request ? new URL(request.url).origin : "http://localhost:3000";
}
export function readinessChecks(request?: Request): Record<string, ReadinessCheck> {
  const present = (name: string) => Boolean(process.env[name]?.trim());
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const promoSecret = process.env.PROMO_FINGERPRINT_SECRET?.trim() ?? "";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  const subscriptionPriceEnvConfigured = ["STRIPE_SUBSCRIPTION_PRICE_PLUS", "STRIPE_SUBSCRIPTION_PRICE_PRO", "STRIPE_SUBSCRIPTION_PRICE_STUDIO"].every((name) => /^price_/u.test(process.env[name]?.trim() ?? ""));
  const adminOwnerIdConfigured = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(process.env.ADMIN_OWNER_USER_ID?.trim() ?? "");
  const adminOwnerEmailConfigured = isConfiguredAdminOwnerEmail(process.env.ADMIN_OWNER_EMAIL);
  const adminOwnerConfigured = adminOwnerIdConfigured || adminOwnerEmailConfigured;
  const preview = isVercelPreview();
  const oidc = hasOidc(request);
  const stripeTestKey = stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_");
  const publicSupabaseConfigured = (present("NEXT_PUBLIC_SUPABASE_URL") || Boolean(DEFAULT_SUPABASE_URL)) && (present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || Boolean(DEFAULT_SUPABASE_PUBLISHABLE_KEY));
  const turnstileConfigured = (present("NEXT_PUBLIC_TURNSTILE_SITE_KEY") && present("TURNSTILE_SECRET_KEY")) || preview;
  const stripePricesConfigured = (present("STRIPE_PRICE_STARTER") && present("STRIPE_PRICE_PLUS") && present("STRIPE_PRICE_PRO")) || (stripeTestKey && CONTROLLED_LAUNCH_TEST_PRICE_IDS.every(Boolean));
  const subscriptionPricesConfigured = subscriptionPriceEnvConfigured || (stripeTestKey && CONTROLLED_LAUNCH_TEST_SUBSCRIPTION_PRICE_IDS.every(Boolean));
  const supportEmailConfigured = isConfiguredSupportEmail(supportEmail);
  return {
    appUrl: { configured: present("NEXT_PUBLIC_APP_URL") || Boolean(vercelOrigin()), required: true },
    supabasePublic: { configured: publicSupabaseConfigured, required: true },
    supabaseServer: { configured: present("SUPABASE_SECRET_KEY"), required: true },
    aiGateway: { configured: present("AI_GATEWAY_API_KEY") || oidc, required: true },
    turnstile: { configured: turnstileConfigured, required: true },
    rateLimitSalt: { configured: present("RATE_LIMIT_HASH_SALT") || oidc || (preview && Boolean(process.env.VERCEL_DEPLOYMENT_ID)), required: true },
    promoFingerprintSecret: { configured: promoSecret.length >= 32, required: true },
    supportEmail: { configured: supportEmailConfigured, required: true },
    stripeTestMode: { configured: stripeTestKey && present("STRIPE_WEBHOOK_SECRET") && stripePricesConfigured, required: true },
    subscriptionCatalog: { configured: subscriptionPricesConfigured, required: true },
    // Bootstrap configuration is intentionally optional after an owner has been
    // provisioned in ops.admin_users. /api/readiness combines this signal with
    // authoritative database state in its required adminOwner check.
    adminOwnerBootstrap: { configured: adminOwnerConfigured, required: false },
    cron: { configured: present("CRON_SECRET"), required: !preview },
  };
}
export function readinessSummary(request?: Request) { const checks = readinessChecks(request); const missing = Object.entries(checks).filter(([, check]) => check.required && !check.configured).map(([name]) => name); return { ready: missing.length === 0, checks, missing }; }
