# Security boundaries

## Authority map

- **Browser:** untrusted input and presentation. It cannot grant entitlement, settle credits, choose Stripe price IDs, or authorize another user's records.
- **Route handlers:** validate payloads, enforce authentication/ownership and same-origin mutation policy, apply abuse/rate limits, and call server-side operation logic.
- **Supabase service role:** server-only; must never reach client bundles. Database policies and RPC constraints remain the authority for account-owned state and financial operations.
- **Stripe:** payment provider; only signature-verified, replay-safe webhook events may settle purchases or subscriptions.
- **AI Gateway/model:** untrusted statistical output. The application restores and validates protected facts before accepting a result.
- **Telemetry:** operational metadata only; no raw documents, generated prose, secrets, auth tokens, or API keys.

## Invariants to preserve

1. Client state cannot grant paid entitlement or mutate authoritative credits.
2. Stripe webhooks require signature verification; replay cannot double-credit.
3. Failed billable operations release/expire reservations safely.
4. Raw customer content is not intentionally persisted in application logs/history.
5. Secrets and API-key plaintext are server-only; API keys are stored as hashes.
6. Cross-user artifact/account access is denied.
7. Signed provenance is not silently destroyed.
8. Model output is validated and never represented as deterministic proof.
9. Offline code cannot bypass billing or server authorization.
10. Receipt verification recomputes hashes rather than trusting mutable display data.

## Current controls and unresolved proof

Source tests cover request-origin checks, CSP/security headers, Stripe mode and signatures, replay/idempotency, API-key hash/revocation, file limits, route auth boundaries and sensitive logging. Production health/readiness are verified. A production penetration run, leaked-password Auth setting, credential scanning automation, external account-ownership journey and Vercel deployment provenance remain unverified. Enable Dependabot/security scanning protections and inspect Supabase Auth configuration in the security phase.
