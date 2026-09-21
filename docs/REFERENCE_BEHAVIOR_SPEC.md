# Reference Behavior Specification

Date: 2026-09-21

The canonical row-per-behavior inventory is `docs/UNCLAUDE_FEATURE_PARITY.md`. This companion specification defines the end-to-end contracts that must remain true across the public product.

## Workbench and content contracts

| Behavior | User state | Input/action | Observable output | Persistent/economic/privacy effect | Evidence |
| --- | --- | --- | --- | --- | --- |
| Free text scan | Signed out or signed in | Paste text/TXT and scan | Exact findings with code points/positions | No account creation; no credit debit; local-first | core/offline E2E |
| Conservative text clean | Guest/account | Clean safe findings | Cleaned text + before/after receipt | Lazy guest if needed; reserve/commit credits; no raw text history | text sanitize route |
| File inspection | Any | Inspect DOCX/PNG/JPEG/PDF/WebP | Metadata/provenance findings | Local-first; zero credits | file engine/E2E |
| File sanitation | Guest/account | Sanitize DOCX/PNG/JPEG | Downloaded cleaned file + verification evidence | 1-credit reserve; commit only after re-inspection; ephemeral bytes | file sanitize route |
| Signed provenance | Any | Inspect C2PA-bearing file | Provenance finding/verification state | Destructive sanitation blocked | C2PA/file tests |
| Parity rewrite | Guest/account | Rewrite text in parity mode | Substantively reworded validated text + receipt | Word-metered reservation; model only after explicit request; content not intentionally persisted | transform tests/E2E |
| Watermark verification | Any | Review rewrite receipt | Explicit unavailable status unless a legitimate detector is configured | Never converts rewrite into a false “verified removed” claim | watermark abstraction |

## Identity and economic contracts

| Behavior | Contract |
| --- | --- |
| Guest creation | Free inspection creates no identity. First economic action may create/reuse an anonymous Supabase identity. |
| Guest promotion | +2 credits once, idempotently. |
| Signup promotion | +3 credits once for genuine signup/upgrade, protected by keyed non-reversible email fingerprint. |
| Pricing | Text/TXT: 1 credit per 1,000 source words rounded up. DOCX/PNG/JPEG sanitation: 1 credit. |
| Failure handling | Credits are reserved before work and committed only after validation; failures release or safely expire reservations. |
| Checkout | Stripe remains TEST mode in the current launch wave. One-time packs retain the observed prices/credit counts and US Checkout policy. |
| Refund | Unused purchased credits inside the refund window are computed from FIFO purchase lots and processed idempotently. |
| Delete | Linked subscriptions are canceled; identity deletion and accounting reconciliation are controlled and readiness-gated. |

## Public/privacy contracts

All launch routes must remain responsive at launch breakpoints, expose a main landmark, avoid horizontal overflow, and keep core workbench actions keyboard reachable. Contact remains mailto-only. Operational storage/logging must exclude submitted document bodies, transformed output, raw file bytes and filenames.

## Reference reachability

The exact current `un-claude.com/capabilities` page is not directly reachable from the verification environment as of this audit. Newly observable behavior must therefore be treated as a new parity row rather than assumed to be absent.
