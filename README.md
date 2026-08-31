# Provenance Cleaner

An **AI provenance and content-hygiene platform** inspired by mechanics reverse-engineered from Un-Claude, intentionally not positioned as an AI-detector bypass product.

## Implemented through Phase 5

- deterministic Unicode inspection and conservative text hygiene
- JPEG/PNG/WebP/DOCX/PDF metadata and provenance inspection
- official C2PA verification, SHA-256 receipts and provenance-safe modification guardrails
- semantics-preserving editing with protected facts and deterministic validation
- Supabase guest/account architecture
- append-only credits with atomic reserve/commit/release/expiry semantics
- fixed credit packs and signature-verified Stripe test Checkout reconciliation
- server-verified Turnstile, burst limiting and database-authoritative spend limits
- request correlation IDs, privacy-safe structured logs and consistent production errors
- stale-reservation reconciliation, health/readiness routes and security headers
- Vitest, Playwright and staged Supabase SQL verification

## Principles

1. Deterministic before generative.
2. Do not corrupt language.
3. Protect signed provenance.
4. Charge only after validated success.
5. Fail closed around billing, bot verification and provider configuration.
6. Do not claim detector-proof output.
7. Receipts over promises.

## Runtime

Node.js 22.22 or later.

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm run test:e2e
```

A dependency lockfile is still a release blocker because package installation could not complete in the available execution environment and GitHub Actions has not been assigning runners. Generate and commit it before release, then use `npm ci`.

Database SQL remains staged until a dedicated Supabase project is explicitly identified. Start with `supabase/schema/phase_4_accounts_credits.sql`, then `supabase/schema/phase_5_hardening.sql`.

See `docs/PHASE_5.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_RUNBOOK.md`, `docs/PRIVACY_ARCHITECTURE.md`, `docs/BILLING_INVARIANTS.md`, `docs/SECURITY_CHECKLIST.md`, and `docs/TESTING.md`.
