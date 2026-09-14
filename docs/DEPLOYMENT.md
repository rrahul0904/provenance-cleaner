# Deployment

## Preconditions

1. Use the existing dedicated Vercel project `provenance-cleaner` and dedicated Supabase project for this product.
2. Keep database migrations ordered and verified with Supabase advisors before release.
3. Keep Stripe in **test mode** until an explicit live-billing launch decision is made.
4. Configure Cloudflare Turnstile and restrict the production widget to production hostnames.
5. Keep high-entropy `RATE_LIMIT_HASH_SALT`, `PROMO_FINGERPRINT_SECRET`, and `CRON_SECRET` values server-only.
6. Configure AI Gateway through Vercel OIDC or a server-only gateway key.
7. Use the committed `package-lock.json` with `npm ci`.
8. Configure the GitHub Actions repository secret `VERCEL_TOKEN` with deploy access to the existing Vercel project. Vercel team/project IDs are non-secret and pinned in the release workflow.

## Environment classes

Client safe: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_BUILD_SHA`.

Server only: `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AI_GATEWAY_API_KEY`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_HASH_SALT`, `PROMO_FINGERPRINT_SECRET`, `CRON_SECRET`, Stripe price IDs, `VERCEL_TOKEN`.

Never prefix a secret with `NEXT_PUBLIC_`.

## Preview gate

A preview is releasable only after `/api/readiness` reports ready, tests/build/E2E pass, Stripe is test mode, database tests/advisors pass, and runtime smoke tests show no application errors.

## Production release gate

A Vercel deployment reaching `READY` is not sufficient evidence that Production is current. The release must also prove exact source provenance.

The release workflow:

1. checks out the exact certified SHA;
2. refuses a `production-release` push that does not equal current `main`;
3. requires `VERCEL_TOKEN` before any Vercel CLI operation;
4. pulls Production configuration and runs predeploy/release gates;
5. runs unit tests, lint, build, and browser E2E;
6. builds a prebuilt Production artifact with `NEXT_PUBLIC_BUILD_SHA` pinned to the exact SHA;
7. deploys the artifact;
8. runs `scripts/verify-production.mjs` until the deployed `/api/health.commitSha` equals the expected SHA and `/api/readiness` is green.

Operators can run the same verifier directly:

```bash
npm run production:verify -- \
  --url https://provenance-cleaner.vercel.app \
  --expected-sha "$(git rev-parse HEAD)"
```

The `production-integrity` GitHub Actions workflow also checks canonical Production after every `main` push, on manual dispatch, and every six hours. A red integrity check means Production is stale, unhealthy, or not provably tied to current `main`; it must not be dismissed as a cosmetic CI failure.

## External security controls

- Enable Supabase Auth leaked-password protection in the Supabase dashboard.
- Enable GitHub branch protection/rulesets for `main` in repository settings. Repository CI complements but does not replace platform branch protection.
- Activate the Admin owner only for a verified, non-anonymous Supabase identity.

## CSP

C2PA verification requires WebAssembly execution; Turnstile requires its script/frame/connect origins. The committed CSP allows `wasm-unsafe-eval`, `https://challenges.cloudflare.com`, blob workers, and the configured Supabase origin while denying framing/object embedding.
