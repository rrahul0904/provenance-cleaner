# Codex Next Phase — Phase 9 Release Integrity

Continue from `main`. Phases 1–8 are implemented; this phase is about making release truth mechanically verifiable and eliminating stale-production ambiguity.

## Goal

A release is only considered current when the canonical Production host is healthy, public readiness is green, and `/api/health.commitSha` exactly matches the certified 40-character Git SHA from `main`.

## Required work

- Keep one reusable production verifier for local/operator use and GitHub Actions.
- Verify `/api/health` and `/api/readiness` together; fail closed on a missing or mismatched commit SHA.
- Run production-drift verification on `main` pushes, manual dispatch, and a periodic schedule.
- Reuse the same verifier after exact prebuilt Vercel Production deployment.
- Keep `NEXT_PUBLIC_BUILD_SHA` pinned during the Vercel build so prebuilt deployments expose exact provenance.
- Keep the production release workflow gated on a single external Vercel credential: `VERCEL_TOKEN`.
- Do not treat a Vercel `READY` state by itself as proof that Production is current.
- Keep Stripe in TEST mode until an explicit live-billing launch decision is made.

## External operator gates

These are not repository defects and must not be bypassed in code:

1. GitHub Actions must contain `VERCEL_TOKEN` with deploy access to the existing `provenance-cleaner` Vercel project.
2. Supabase leaked-password protection should be enabled in Auth settings.
3. Admin owner activation requires a verified, non-anonymous Supabase identity before `ADMIN_OWNER_USER_ID` or verified `ADMIN_OWNER_EMAIL` bootstrap can be used.
4. GitHub `main` branch protection/rulesets should be enabled at the repository settings layer; CI must not pretend to replace platform enforcement.

## Completion evidence

- unit tests, lint, build, browser E2E, release gate, and predeploy checks pass on the exact PR head;
- production-integrity automation exists and intentionally reports stale Production until deployment is promoted;
- exact-main Production deployment passes `npm run production:verify -- --url <production-url> --expected-sha <main-sha>`;
- canonical `https://provenance-cleaner.vercel.app/api/health` returns the exact `main` SHA;
- canonical `/api/readiness` returns `status=ready` and `missing=[]`.
