# User journeys and trust boundaries

These journeys define expected behavior. “Implemented” means code/tests exist; “verified” requires the runtime evidence listed in the current-state audit.

## Guest

`Landing → paste or supported upload → inspect → choose eligible free/local action → review findings → generate/verify receipt → export`

Local inspection should not require signup. A billable action may create a guest identity lazily and must show its credit cost before execution. Guest identity and any grant are server-authoritative. The user must be able to understand which action sends content to the server.

## Registered free user

`Sign up → verify email → sign in → inspect → sanitize/transform if entitled → review result and receipt → inspect history or delete account`

Signup grants apply only to a confirmed eligible account and must be idempotent. Authentication configuration is production-ready, but inbox delivery and the complete live signup/history/deletion journey are not certified by the audit.

## Paying customer (TEST certification flow)

`Sign up → select a server-owned plan → Stripe TEST Checkout → signed webhook → ledger grant → paid action → verified receipt → billing/usage view`

The browser return URL cannot grant value. Duplicate webhooks cannot grant twice. Each step must be reconciled to provider and ledger evidence. A complete production-hosted TEST customer journey remains unverified.

## Returning subscriber

`Login → server-recognized active entitlement → use included capability → view usage → open Stripe Billing Portal`

An expired, canceled, or unavailable subscription must not be presented as active. Portal access and lifecycle events require a verified end-to-end test.

## Failed-payment customer

`Payment failure or delayed webhook → no false entitlement → clear pending/failed state → retry or contact support`

Never convert a browser redirect into a paid state. Delayed or replayed events must reconcile safely and preserve idempotency.

## Offline user

`Go offline → deterministic local inspection continues where supported → receipt labels local provenance → online-only controls show explicit unavailable state`

Offline state cannot grant billing, credits, accounts, API access, or model transformations. Sensitive server responses must not be cached by the service worker.

## File and transform journeys

- File: `select DOCX/PNG/JPEG/PDF → inspect supported metadata/provenance → explain unsupported sanitation for PDF or signed C2PA → sanitize only eligible inputs → verify output → export receipt`.
- Transform: `paste/TXT → choose purpose/intensity → reserve → model candidate → validate protected facts and length → show before/after → accept/export or retry → commit only accepted work`.

Production browser verification of these complete journeys remains outstanding.
