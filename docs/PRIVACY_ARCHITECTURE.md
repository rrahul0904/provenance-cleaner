# Privacy architecture

## Local-only paths

Interactive Unicode scanning, supported file inspection, hashing, receipt generation and C2PA verification execute in the browser workbench. They do not require an account and do not debit credits.

## Ephemeral server-authoritative sanitation

Billable text sanitation and DOCX/PNG/JPEG sanitation pass the submitted text or file bytes through an ephemeral application-server request so credit reservation, sanitation, output verification and commit/release semantics can be enforced together.

The service does not intentionally persist raw text, file bytes, filenames, extracted document text or transformed output as billing/history records. File-job history is limited to operational metadata such as input kind, credit count, status, time and bounded size buckets.

## Semantic editing boundary

Only an explicit semantic-edit action sends prose to the configured model through Vercel AI Gateway. Protected factual spans are tokenized before model generation and restored only after deterministic validation. The application does not intentionally persist source or output text.

## Operational logs

Structured logs contain request IDs, hashed user/client subjects, operation IDs, bounded size/word buckets, model names, statuses and latency. The logger defensively redacts keys associated with body/content/text/tokens/cookies/secrets/signatures/raw payloads/IPs.

Raw IP addresses are not intentionally persisted by the application. Application burst keys are salted hashes. Hosting/CDN providers may independently process network metadata under their own service policies.

## Billing and identity data

Supabase stores identity/session data plus credit accounts, append-only ledger rows, reservations, purchase/subscription identifiers and bounded reconciliation metadata. Document bodies and filenames are not billing fields.

Developer API secrets are stored only as one-way hashes plus short display prefixes. Signup-promotion abuse prevention retains a keyed non-reversible email fingerprint rather than the raw email solely for re-claim prevention.

## Third parties

- Supabase: authentication, billing/accounting state and privacy-safe account history.
- Vercel AI Gateway/model provider: semantic editing only after an explicit edit action.
- Stripe: TEST-mode Checkout/subscription/payment reconciliation; no source prose or filenames.
- Cloudflare Turnstile: bot challenge tokens; tokens are verified server-side and not logged.
- Content Authenticity Initiative C2PA browser SDK: local provenance verification.

## Analytics

Product analytics is currently disabled. Any future activation must remain cookieless/memoryless, exclude submitted content and filenames, and emit zero events when Do Not Track is enabled.
