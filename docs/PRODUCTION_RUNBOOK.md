# Production runbook

## Deploy

Production deploys are source-certified and fail closed. Git-backed CLI deploys use the exact Git SHA plus the source fingerprint; OAuth direct-file deploys use the same certified source fingerprint when Vercel does not expose Git SHA metadata.

1. Confirm `main` and `production-release` point to the same certified commit.
2. Run `npm run release:manifest:check`; `release/source-manifest.json` must match every tracked Git blob except the manifest itself.
3. Confirm Supabase Phase 6–9 readiness, including Phase 9 schema `20260915032600` with `atomicKeyCap: true`.
4. Confirm Stripe remains TEST mode unless a separate production-payment decision has been approved.
5. Use one of the two authorized release paths below.
6. Verify `/api/health` reports the certified `sourceHash`, release ID, Phase 9, and Node 24.x. If Git SHA metadata exists, it must also equal the certified commit.
7. Verify `/api/readiness` returns `ready` with no required checks missing.

### Path A — GitHub Actions exact-SHA deployment

Use this path when the GitHub `production` environment contains `VERCEL_TOKEN`.

- Push the certified SHA to `production-release` or dispatch `deploy-production` with that exact SHA.
- The workflow reruns preflight, release gate, unit tests, lint, build, Playwright E2E and migration safety, then deploys one prebuilt Production artifact.
- Verification requires both the exact Git SHA and the certified source fingerprint.

### Path B — OAuth direct-file deployment

Use this path through the connected Vercel OAuth deployment tool when a CI deployment token is intentionally unavailable.

- Materialize the deployment payload byte-for-byte from the exact certified GitHub commit. Do not use an edited local working tree.
- Push the certified SHA to `production-release`; `prepare-oauth-production-payload` verifies it matches current `main`, checks the source manifest, generates 14 bounded transport parts, and force-updates the temporary `oauth-production-payload` branch.
- Fetch only the exact committed `package.json`, `package-lock.json`, `release/source-manifest.json`, `release/oauth-unpack.mjs`, `vercel.json`, plus the 14 generated `release/oauth-bundle-*.json` files. Every bundle carries the certified `sourceHash` and every source file carries its Git blob SHA. `release/oauth-unpack.mjs` recomputes each Git blob SHA and the complete tracked-source fingerprint, and rejects missing/altered/duplicate/injected paths or traversal before the Next.js build.
- Send those bounded files to the existing `provenance-cleaner` Vercel project with target `production`.
- Direct-file deployments may not expose `VERCEL_GIT_COMMIT_SHA`; in that case production certification uses the committed `sourceHash`.
- The source fingerprint is not optional: production verification fails if it is absent or differs from the certified manifest.
- Record the deployment ID/URL and run the same health/readiness verification immediately after deployment.

Do not deploy modified or untracked application source merely to clear an integrity check.

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

