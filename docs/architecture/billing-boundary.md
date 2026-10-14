# Billing and entitlement boundary

## Trust model

The browser can select a public plan key but cannot set a Stripe price, credit quantity, balance, or entitlement. The server maps plan keys to configured Stripe TEST prices. A checkout redirect is not payment evidence; a signature-verified webhook and database transaction are authoritative.

## Billable operation lifecycle

```text
validate and inspect → plan → atomically reserve → execute → validate output
                                                        ├── valid: commit once
                                                        └── failure: release/expire safely
```

Reservations and operation keys make retries/concurrency safe. Settled credits come from the append-only ledger. Refunds use purchased credit lots and provider idempotency. Subscription access must be derived from reconciled provider state, not browser state.

## Current product rules

- Text/TXT: one credit per 1,000 words, rounded up with a one-credit minimum.
- DOCX/PNG/JPEG sanitation: one credit; PDF is inspection-only.
- Stripe integration is TEST-only; catalog values are not live activation.
- Guest/signup promotional grants require server-side eligibility and idempotency.

## Proof still required

Current tests cover operation reservations, duplicate events, replay, test-mode enforcement, reconciliation and proportional refunds. No complete hosted Stripe TEST journey was exercised in this audit. Certification must link provider event/session IDs to the resulting ledger entry, a paid operation, usage/balance, subscription portal state, refund, and repeat/replay behavior without recording customer prose.
