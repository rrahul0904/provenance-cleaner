# Product contract

**Status:** Phase 1 baseline, updated for Phase 2 inspection coverage on 2026-10-13. This contract describes the current product behavior supported by the repository. A listed implementation is not a claim that its complete production journey has been certified; see [the current-state audit](../release/current-state-audit.md) and [Phase 2 inspection receipt](../release/phase2-core-inspection.md).

## Product promise

Provenance Cleaner is a content-integrity workbench for inspecting text and supported files, understanding provenance signals, making conservative sanitation changes, safely editing prose, and producing verifiable evidence. It does not promise detector evasion, “undetectable AI,” watermark removal, or preservation of a cryptographic signature after its signed bytes are changed.

## User-visible capabilities

| Capability | Contract |
| --- | --- |
| Inspect | Deterministic Unicode/text checks and supported file metadata/provenance inspection explain findings. C0/C1 control characters are flagged for review; tabs, line feeds, carriage returns, and next-line whitespace are preserved. Inspection is free and local-first where supported. |
| Sanitize | Sanitation is a separate, explicit action. Text and supported file sanitation are server-authoritative when credits apply; signed provenance and Office package signatures block destructive sanitation. Malformed supported-file structures fail before billing. |
| Transform | Semantic editing occurs only after an explicit user action. Light/Balanced/Strong intent and purpose control the request. Protected names, dates, numbers, percentages, quotes, citations and other extracted invariants are checked before acceptance. Model output is untrusted until validation passes. |
| Verify and receipt | Receipts identify the input/output artifact with hashes and operation metadata. Verification must recompute integrity rather than trust mutable UI state. |
| Export | Users can copy/download outputs and receipts; source content is not intentionally retained as account history. |
| Style analysis | StyleBalanceMeter provides explainable writing metrics, not an AI-origin verdict or bypass score. |
| Offline | Deterministic local inspection and receipt operations may remain available. Account, billing, paid sanitation and model operations require trusted online services and must fail clearly offline. |

## Limits and billing

- Semantic editing accepts at most 8,000 whitespace-delimited words per operation.
- Supported billable file formats are DOCX, PNG, and JPEG, up to 3.2 MiB. PDF is inspection-only; TXT follows text processing.
- Text/TXT cost is one credit per 1,000 words, rounded up with a one-credit minimum. A supported file sanitation costs one credit.
- Guest and signup promotional credit rules are centrally defined in `src/lib/product-contract.ts`; grant/replay behavior remains server-authoritative.
- Stripe is TEST mode. Committed catalog fallbacks are test values; they do not imply live payment activation or commercial launch.
- Client state cannot create entitlement, grant credits, choose arbitrary price IDs, or settle a paid operation.

## Data and trust promises

- Local inspection does not require an account or send content to the application server.
- Billable sanitation and explicit semantic editing send content to the application runtime/provider transiently as needed; raw content is not intentionally persisted in billing history or operational logs.
- Supabase persists identity and operational/accounting records. Stripe receives payment data and identifiers, not document prose. Model processing occurs only for explicit semantic editing.
- Application history stores operation metadata, not raw document text or file bytes.
- Analytics is currently disabled.
- Hosting and third-party providers may process network/service metadata under their own terms; the application cannot promise that provider infrastructure retains no operational metadata.

## Error and recovery contract

Before any billable operation, validate input and plan the work. Reserve credits atomically, execute, validate output, then commit. A provider, validation, timeout, or downstream failure must release or safely expire the reservation. Retries must use an idempotency key. A success redirect is not proof of payment; only a verified provider event may grant a purchase.

## Claims and maturity

Public claims must be tied to observable evidence. Provenance Cleaner may describe an implementation as production-verified only after the relevant production journey passes. The global product is not yet certified sellable, launched, or validated: Stripe is TEST-only and the full production customer journeys and commercial evidence remain outstanding.
