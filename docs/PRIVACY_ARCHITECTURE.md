# Privacy architecture

## Local-only paths

Unicode scanning, supported file inspection/sanitization, hashing and C2PA verification execute in the browser. They do not use the billing API.

## Semantic editing boundary

Only an explicit edit sends prose to the server/model. Protected factual spans are replaced before model generation. The application does not intentionally persist source or output text.

## Operational logs

Structured logs contain request IDs, hashed user/client subjects, operation IDs, counts, model names, statuses and latency. The logger defensively redacts keys associated with body/content/text/tokens/cookies/secrets/signatures/raw payloads/IPs.

Raw IP addresses are not persisted by the application. Application burst keys are salted hashes. Hosting/CDN providers may independently process network metadata under their own service policies.

## Billing data

Credit accounts, ledger rows, reservations, purchase IDs, Stripe session/event IDs and pack metadata are stored. Document bodies are not billing fields.

## Third parties

- Supabase: authentication and billing database once explicitly linked.
- Vercel AI Gateway/model provider: semantic editing only after explicit action.
- Stripe: Checkout/payment state; no source prose.
- Cloudflare Turnstile: bot challenge tokens; tokens are verified server-side and not logged.
- Content Authenticity Initiative C2PA browser SDK: local provenance verification.
