# Testing

## Unit

`npm test` covers deterministic provenance behavior plus Phase 5 request parsing, request IDs, burst limiting, Turnstile server verification/redaction and Stripe test-mode enforcement.

## Browser

`npm run test:e2e` runs Chromium via Playwright. It covers local Unicode scanning, image metadata sanitation, provenance-blocked sanitation, mocked semantic-edit success/error, mocked guest/billing UX and security/readiness headers. It uses explicit development-only Turnstile bypass variables and never performs a real model call or payment.

## Database

Against a dedicated dev/test Supabase database with an existing test auth user:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v TEST_USER_ID='<uuid>' -f supabase/tests/phase_4_billing.sql
```

The script runs in a transaction and rolls back. See `supabase/tests/README.md` for concurrency verification.

## Required release commands

```bash
npm install
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

After a real lockfile is generated and committed, replace install with `npm ci` locally and in CI.
