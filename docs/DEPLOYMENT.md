# Deployment

## Preconditions

1. Import `rrahul0904/provenance-cleaner` into a dedicated Vercel project.
2. Identify/create a dedicated Supabase project for this product; never reuse a generic project by assumption.
3. Apply Phase 4 then Phase 5 SQL to dev/test, run database tests and Supabase advisors, then generate migration history.
4. Configure Stripe **test mode** prices/webhook only.
5. Configure Cloudflare Turnstile and restrict the production widget to production hostnames.
6. Generate a high-entropy `RATE_LIMIT_HASH_SALT` and `CRON_SECRET`.
7. Configure AI Gateway through Vercel OIDC or a server-only gateway key.
8. Generate/commit `package-lock.json`; use `npm ci`.

## Environment classes

Client safe: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Server only: `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AI_GATEWAY_API_KEY`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_HASH_SALT`, `CRON_SECRET`, Stripe price IDs.

Never prefix a secret with `NEXT_PUBLIC_`.

## Preview gate

A preview is releasable only after `/api/readiness` reports ready, tests/build/E2E pass, Stripe is test mode, database tests/advisors pass and runtime smoke tests show no errors.

## CSP

C2PA verification requires WebAssembly execution; Turnstile requires its script/frame/connect origins. The committed CSP allows `wasm-unsafe-eval`, `https://challenges.cloudflare.com`, blob workers, and the configured Supabase origin while denying framing/object embedding.
