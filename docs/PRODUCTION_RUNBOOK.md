# Production runbook

## Deploy

Validate CI, Supabase migrations/advisors, Stripe test-mode webhook, `/api/readiness`, preview smoke tests, then promote the validated Vercel preview. Production payment enablement is outside Phase 5.

## Rollback

Promote the last known-good Vercel deployment. Do not roll back append-only credit ledger entries. If a schema change is involved, use an explicit forward fix unless a tested reversible migration exists.

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

Rotate the affected provider secret immediately, update Vercel Preview/Production environments, redeploy, rotate webhook/Turnstile counterparts where relevant, and search logs only by non-sensitive request/event identifiers.

## Observability

Primary structured event fields: requestId, userIdHash/subjectHash, operationId, route, status, credits, counts, model, attempts, latencyMs. Provider dashboard links should be added here after projects are connected.
