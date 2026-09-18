# Production runbook

## Deploy

Production deploys are exact-SHA and fail closed.

1. Confirm `main` and `production-release` point to the same certified commit.
2. Confirm the GitHub `production` environment contains `VERCEL_TOKEN` with deployment access to the configured Vercel team/project.
3. Confirm Supabase Phase 6–9 readiness, including Phase 9 schema `20260915032600` with `atomicKeyCap: true`.
4. Confirm Stripe remains TEST mode unless a separate production-payment decision has been approved.
5. Push the certified SHA to `production-release` or dispatch `deploy-production` with that exact SHA.
6. The workflow must rerun preflight, release gate, unit tests, lint, build, Playwright E2E, migration safety, and then deploy one prebuilt Vercel Production artifact.
7. Verify the deployed `/api/health` returns the exact expected commit SHA and Phase 9 metadata.
8. Verify `/api/readiness` returns `ready` with no required checks missing.

Do not bypass the workflow with an ad-hoc production deployment merely to clear an integrity check.

## Rollback

Promote the last known-good Vercel deployment only when its application/database compatibility is understood. Do not roll back append-only credit ledger entries. If a schema change is involved, use an explicit forward fix unless a tested reversible migration exists.

## Model outage

`/api/transform` releases the reservation on provider error; if release fails, TTL reconciliation is the recovery path. Investigate `model_provider_error` events by request ID.

## Reservation reconciliation

Lazy expiry runs during balance/reservation calls. Vercel cron also calls `/api/internal/reconcile` daily using `CRON_SECRET`, with a bounded 200-row batch and `SKIP LOCKED`.

## Stripe webhook

Check signature configuration, Stripe delivery status, request ID, event ID and `webhook_reconciliation_failed` events. Replayed events are idempotent; never manually mark a Checkout successful from the browser redirect.

## Credit adjustment

Use a new append-only ledger grant/adjustment source key through an audited server/admin procedure. Never update existing ledger rows.

## Rate limit / bot incidents

Inspect `rate_limit_triggered` and `bot_challenge_failed` counts. Do not log raw IP or Turnstile tokens. Database credit limits remain authoritative for model spend.

## Supabase incident

Confirm project identity before any mutation. Inspect Auth/API/Postgres logs and advisors. Rotate secret/publishable keys as needed. Remember user deletion does not instantly invalidate all already-issued access tokens; revoke/sign out sessions when strict invalidation is required.

## Secret compromise

Rotate the affected provider secret immediately, update Vercel Preview/Production environments, redeploy through the exact-SHA release path, rotate webhook/Turnstile counterparts where relevant, and search logs only by non-sensitive request/event identifiers.

## Observability

Primary structured event fields: requestId, userIdHash/subjectHash, operationId, route, status, credits, counts, model, attempts, latencyMs.

Operational release evidence includes:

- exact `main` SHA
- exact `production-release` SHA
- GitHub CI and deployment-readiness results
- Vercel deployment ID/URL
- `/api/health` commit SHA, application version and phase
- `/api/readiness` required checks
- Supabase Phase 6–9 status

