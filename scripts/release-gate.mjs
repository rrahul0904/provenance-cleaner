import { existsSync, readFileSync } from "node:fs";

const checks=[];
const add=(name,ok,detail)=>checks.push({name,ok,detail});
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const placeholderEmail=/(^|@)(example\.(com|invalid|org)|invalid|localhost)$|placeholder/iu;
const validOperationalEmail=(value)=>emailPattern.test(value)&&!placeholderEmail.test(value);
const validUuid=(value)=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(value);

add("Node >= 22.22",(()=>{const [major,minor]=process.versions.node.split(".").map(Number);return major>22||(major===22&&minor>=22);})(),process.versions.node);
add("package-lock.json committed",existsSync("package-lock.json"),existsSync("package-lock.json")?"present":"missing");

const requiredClient=["NEXT_PUBLIC_APP_URL","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","NEXT_PUBLIC_TURNSTILE_SITE_KEY","NEXT_PUBLIC_SUPPORT_EMAIL"];
const requiredServer=["SUPABASE_SECRET_KEY","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","TURNSTILE_SECRET_KEY","RATE_LIMIT_HASH_SALT","PROMO_FINGERPRINT_SECRET","CRON_SECRET","STRIPE_PRICE_STARTER","STRIPE_PRICE_PLUS","STRIPE_PRICE_PRO","STRIPE_SUBSCRIPTION_PRICE_PLUS","STRIPE_SUBSCRIPTION_PRICE_PRO","STRIPE_SUBSCRIPTION_PRICE_STUDIO"];
for(const name of [...requiredClient,...requiredServer])add(`env:${name}`,Boolean(process.env[name]?.trim()),process.env[name]?.trim()?"configured":"missing");

add("PROMO_FINGERPRINT_SECRET length",(process.env.PROMO_FINGERPRINT_SECRET?.length??0)>=32,process.env.PROMO_FINGERPRINT_SECRET?"configured":"missing");
const supportEmail=process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()??"";
add("Production support email",validOperationalEmail(supportEmail),supportEmail?"configured":"missing");

const subscriptionPriceNames=["STRIPE_SUBSCRIPTION_PRICE_PLUS","STRIPE_SUBSCRIPTION_PRICE_PRO","STRIPE_SUBSCRIPTION_PRICE_STUDIO"];
add("Stripe TEST subscription env catalog",subscriptionPriceNames.every((name)=>/^price_/u.test(process.env[name]?.trim()??"")),"three recurring price IDs required");

const subscriptionCatalogPath="src/lib/billing/subscriptions.ts";
const subscriptionCatalog=existsSync(subscriptionCatalogPath)?readFileSync(subscriptionCatalogPath,"utf8"):"";
add("Stripe TEST subscription fallback catalog",["price_1UBmgJRB8OGmEnBwoUtRmBKb","price_1UBmhIRB8OGmEnBwFEJNV4zF","price_1UBmiARB8OGmEnBwgoMzZqbw"].every((id)=>subscriptionCatalog.includes(id)),"controlled TEST fallback catalog committed");

const ownerId=process.env.ADMIN_OWNER_USER_ID?.trim()??"";
const ownerEmail=process.env.ADMIN_OWNER_EMAIL?.trim()??"";
const ownerBootstrapValid=(ownerId&&validUuid(ownerId))||(!ownerId&&validOperationalEmail(ownerEmail));
add("Admin owner bootstrap",Boolean(ownerBootstrapValid),ownerId?"UUID configured":ownerEmail?"verified-email bootstrap configured":"missing");

if(process.env.STRIPE_SECRET_KEY)add("Stripe test mode",process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")||process.env.STRIPE_SECRET_KEY.startsWith("rk_test_"),"live keys are forbidden during controlled launch");
if(process.env.NEXT_PUBLIC_APP_URL)add("HTTPS app URL",/^https:\/\//u.test(process.env.NEXT_PUBLIC_APP_URL),process.env.NEXT_PUBLIC_APP_URL);

const packageJson=JSON.parse(readFileSync("package.json","utf8"));
add("Pinned dependencies",Object.values({...(packageJson.dependencies??{}),...(packageJson.devDependencies??{})}).every((v)=>/^\d+\.\d+\.\d+/u.test(v)),"no ranges allowed");

const finalPhase6Migration="supabase/migrations/20260902034500_phase6_deletion_recovery.sql";
const phase7Migration="supabase/migrations/20260903144643_phase7_admin_finops_subscriptions.sql";
const finopsRevenueMigration="supabase/migrations/20260909043500_phase8_finops_revenue.sql";
add("Final Phase 6 recovery migration committed",existsSync(finalPhase6Migration),finalPhase6Migration);
if(existsSync(finalPhase6Migration)){const migration=readFileSync(finalPhase6Migration,"utf8");add("Phase 6 recovery schema version",migration.includes("'schemaVersion', '20260902034500'"),"20260902034500");add("Phase 6 stale deletion recovery",migration.includes("deletion_requested_at <= now() - interval '10 minutes'"),"failed prepare/cancel paths recover automatically");}
add("Phase 7 control-plane migration committed",existsSync(phase7Migration),phase7Migration);
if(existsSync(phase7Migration)){const migration=readFileSync(phase7Migration,"utf8");add("Phase 7 private ops schema",migration.includes("create schema if not exists ops"),"ops schema");add("Phase 7 admin RBAC",migration.includes("ops.admin_users")&&migration.includes("'owner', 'admin', 'viewer'"),"server-controlled roles");add("Phase 7 subscription grants",migration.includes("billing.subscription_period_grants")&&migration.includes("subscription_invoice:"),"idempotent invoice grants");}
add("Phase 8 FinOps revenue migration committed",existsSync(finopsRevenueMigration),finopsRevenueMigration);
if(existsSync(finopsRevenueMigration)){const migration=readFileSync(finopsRevenueMigration,"utf8");add("Privacy-safe TEST revenue evidence",migration.includes("billing_record_checkout_amount")&&migration.includes("billing_record_subscription_invoice_amount"),"integer cents + currency only");add("Phase 8 FinOps schema version",migration.includes("'schemaVersion','20260909043500'"),"20260909043500");}

const readinessPath="src/app/api/readiness/route.ts";
if(existsSync(readinessPath)){
  const readiness=readFileSync(readinessPath,"utf8");
  add("Readiness requires final Phase 6",readiness.includes('REQUIRED_PHASE6_SCHEMA = "20260902034500"'),"exact Phase 6 schema required");
  add("Readiness requires final Phase 7",readiness.includes('REQUIRED_PHASE7_SCHEMA = "20260903144643"')&&readiness.includes("phase7Schema"),"exact Phase 7 schema required");
  add("Readiness requires final Phase 8",readiness.includes('REQUIRED_PHASE8_SCHEMA = "20260909043500"')&&readiness.includes("phase8Schema"),"exact Phase 8 FinOps schema required");
}else{
  add("Readiness requires final Phase 6",false,"readiness route missing");
  add("Readiness requires final Phase 7",false,"readiness route missing");
  add("Readiness requires final Phase 8",false,"readiness route missing");
}

for(const item of checks)console.log(`${item.ok?"PASS":"FAIL"} ${item.name} — ${item.detail}`);
const failed=checks.filter((item)=>!item.ok);
if(failed.length){console.error(`\nControlled-launch gate failed: ${failed.length} check(s).`);process.exit(1);}
console.log("\nControlled-launch static gate passed. Runtime, DB, CI and deployed verification are still required.");
