# Provenance Cleaner

An **AI provenance and content-hygiene platform** inspired by clean-room observation of public product mechanics, intentionally not positioned as an AI-detector bypass product.

## Implemented through Phase 8

- deterministic Unicode inspection and conservative text hygiene
- JPEG/PNG/WebP/DOCX/PDF metadata and provenance inspection
- server-authoritative DOCX/PNG/JPEG sanitation with post-clean verification
- official C2PA verification, SHA-256 receipts and provenance-safe modification guardrails
- semantics-preserving AI editing with protected facts, bounded retries and deterministic validation
- Supabase anonymous/registered account architecture with upgrade-preserving credit history
- append-only FIFO credits with atomic reserve/commit/release/expiry semantics
- Stripe TEST one-time Checkout, webhook reconciliation and proportional unused-credit refunds
- Stripe TEST monthly subscriptions, invoice-authoritative credit grants and Billing Portal
- account history, privacy-safe job history, refunds and controlled account deletion
- server-verified Turnstile, burst limiting and database-authoritative spend limits
- Admin Command Center with growth, usage, billing, subscription, FinOps and system evidence
- privacy-safe operations rollups, cost evidence and release-readiness contracts
- request correlation IDs, structured logs, health/readiness routes and security headers
- committed dependency lockfile, Vitest, Playwright, Supabase migration tests and exact-SHA release workflows

## Principles

1. Deterministic before generative.
2. Do not corrupt language.
3. Protect signed provenance.
4. Charge only after validated success.
5. Fail closed around billing, bot verification and provider configuration.
6. Do not claim detector-proof output.
7. Receipts over promises.
8. Deployment evidence must match the exact release SHA.

## Runtime

Node.js 22.22 or later.

```bash
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run test:e2e
```

The repository includes real Supabase migrations through Phase 8 and a controlled exact-SHA Vercel release workflow. Automatic Git deployments are intentionally disabled so production can only receive an explicitly certified artifact.

PDF remains inspection-only; billable server file sanitation supports DOCX, PNG and JPEG. Stripe remains TEST mode until a separate explicit production-payments decision is made.

See `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT_READY.md`, `docs/PRODUCTION_RUNBOOK.md`, `docs/PRIVACY_ARCHITECTURE.md`, `docs/BILLING_INVARIANTS.md`, `docs/SECURITY_CHECKLIST.md`, `docs/ADMIN_CONSOLE.md`, and `docs/TESTING.md`.
