# Provenance Cleaner — Final Parity Re-Audit Findings

Date: 2026-09-01

Repository: `rrahul0904/provenance-cleaner`

Baseline main SHA reviewed: `e5c5aa20693d081e400c16eb690d43ceef92d7a9`

Repair branch: `final-parity-audit-completion`

PR: #13 — Final parity audit and completion

## Conclusion

Full clean-room observable parity is **not yet proven**. The prior matrix captured a meaningful portion of the product, but it was too coarse to establish that every public behavior, economic side effect, privacy effect, error state, responsive state, and production dependency had been discovered and verified.

The release rule remains: do not equate a page, migration file, passing unit test, merged PR, or READY deployment with full parity. A launch-critical behavior is complete only when discovery, implementation, runtime behavior, economic state, privacy behavior, error behavior, and evidence all agree.

## Findings confirmed against the actual baseline

| Area | Baseline finding | Repair status in PR #13 | Release status |
| --- | --- | --- | --- |
| GitHub CI | 42 unit tests passed, but lint failed on internal anchors and a React effect-state violation | Fixed; verify job now reaches tests, lint, build, audit, and release gate | VERIFYING |
| Vercel production | `e5c5aa…` failed TypeScript | Anonymous claim typing and Stripe `collected_information.shipping_details` corrected | VERIFIED IN PREVIEW BUILD |
| Signup promo | Ordinary sign-in attempted signup promo | Promo request now tied to signup/upgrade callback intent | SOURCE FIXED; RUNTIME TEST REQUIRED |
| Promo secret | Code required `PROMO_FINGERPRINT_SECRET`, readiness did not | Added to `.env.example`, release gate, readiness, minimum length | PREVIEW ENV STILL MISSING |
| Phase 6 database | Promo/refund/history tables/RPCs absent from live Supabase | Not applied | BLOCKED: MIGRATION REDESIGN REQUIRED |
| Phase 6 refund math | Existing SQL infers refundable credits from global balance | Not applied | BLOCKED: FIFO LOT ACCOUNTING REQUIRED |
| Account deletion | Auth-user cascades conflict with append-only ledger delete trigger | Not changed | BLOCKED: CONTROLLED DELETION/ANONYMIZATION REQUIRED |
| File cleaning | UI called DOCX/PNG/JPEG a 1-credit job but cleaned entirely in browser without debit | New ephemeral server-authoritative reserve/sanitize/verify/commit route added | SOURCE FIXED; E2E REQUIRED |
| DOCX safety | `unzipSync` expanded packages without a preflight bound | Entry count, per-entry size, total expanded size, compression ratio, unsafe-path preflight + regression fixture added | SOURCE TESTED; CI VERIFYING |
| C2PA | `untrusted` could outrank cryptographic mismatch/tamper | Invalid/tamper now has precedence + regression test | SOURCE TESTED; CI VERIFYING |
| C2PA async | File A verification could land beside file B | Selection-token guard added | SOURCE FIXED; BROWSER TEST REQUIRED |
| Transform stale output | Source could change while old result remained/in-flight | Revision + abort/discard invalidation added | SOURCE FIXED; BROWSER TEST REQUIRED |
| Whitespace-only input | Schema minimum did not trim first | Server schema now trims before minimum | SOURCE FIXED; TEST REQUIRED |
| Rate limiting | High-cardinality subjects could keep warm-process map large | Hard 5,000-bucket bound/eviction + regression test | SOURCE TESTED; DISTRIBUTED LIMIT STILL OPTIONAL |
| Public navigation | Public product pages were not exposed by primary navigation | Global public header/footer added | SOURCE FIXED; RESPONSIVE/A11Y TEST REQUIRED |
| Internal public copy | Home footer exposed `Phase 5 · Production hardening` | Removed | SOURCE FIXED |

## Remaining product-engineering gaps that must not be lost

1. Re-audit the live reference from scratch with a real browser and produce an evidence-backed behavior inventory. Current search/fetch tooling could not reliably reach `un-claude.com`, so the exact present-day black-box behavior has not been reconfirmed in this wave.
2. Replace the coarse parity matrix with `docs/REFERENCE_BEHAVIOR_SPEC.md`, one row per observable behavior and state.
3. Determine the exact publicly observable nine Unicode scanner classes with low-volume controlled fixtures; do not guess. Record safe-removal versus language/emoji-risk divergences.
4. Add one central `SanitizationJob` orchestration model so users choose an input, not an internal engine. Route pasted text, TXT, DOCX, PNG, and JPEG automatically.
5. Add an explicit `parity`/`sanitize` semantic-edit mode. Existing modes are `natural`, `clarity`, `concise`, `formal`; their length bounds are not the parity ±10% contract.
6. Enforce parity rewrite invariants outside protected spans: approximately 90–110% length and no more than three consecutive unprotected source words when the reference still exhibits that behavior.
7. Improve deterministic protected invariants. Current number protection does not capture a leading `+`/`-` as part of the number, and named entities are not protected as a distinct invariant class.
8. Expand the rewrite receipt to include source/output words, length retained, wording replaced, longest unprotected shared run, numeric/date/entity checks, quote/reference preservation, protected span count, model, attempts, and credits.
9. Add `TextWatermarkVerifier` abstraction whose current implementation explicitly reports unavailable unless a legitimate verifier is available. Never label statistical watermark removal as verified.
10. Change exact operational content-derived log counts to privacy-safe buckets unless exact precision is demonstrably required.
11. Redesign Phase 6 database accounting before applying it: real migration history, promo claims, purchase refunds, account history, FIFO purchase-lot consumption/refund math, concurrency/idempotency, deletion/anonymization, payment reconciliation retention, and service-role-only privileged RPCs.
12. Prove guest→account upgrade for both Google and email/password while preserving credits/history without duplication.
13. Prove guest persistence semantics and cookie/session security without browser fingerprinting.
14. Prove exactly-once guest +2 and signup +3 under concurrent requests and deletion/recreation scenarios.
15. Add operational history for charged file jobs using only kind, credits, time, status, and size bucket; never filename, bytes, or extracted raw text.
16. Verify Stripe TEST checkout, webhook replay, non-US enforcement, checkout-success reconciliation polling, proportional refund, retry behavior, and the paid-but-not-creditable reconciliation path. Existing refund route already uses a Stripe idempotency key; database reconciliation still needs proof.
17. Decide PostHog explicitly: implement true cookieless/memoryless analytics with zero events under DNT, or mark analytics as an intentional divergence and keep policy copy accurate.
18. Verify Cloudflare/Turnstile page/action protection and prove Preview test credentials cannot be used in Production.
19. Build vendor evidence only from current official sources; do not copy competitor claims or press logos.
20. Complete responsive, accessibility, contact-form network, file-boundary, rewrite-boundary, privacy-log/database/Stripe-metadata, Preview, and Production test matrices.

## Live infrastructure state observed during this re-audit

- Supabase Phase 4 credit account/ledger/reservation/purchase objects exist.
- The Phase 6 promo/refund/history objects queried in the current project do not exist.
- Latest PR Preview for branch head `590329c83c4b9808f1a7203aead462bcb52751a2` reached Vercel `READY`.
- Preview `/api/readiness` returns 503 solely because `promoFingerprintSecret` is not configured in the Preview environment at the time checked.
- Stripe must remain TEST MODE ONLY throughout this completion wave.

## Completion rule

Allowed final parity statuses for launch-critical rows: `VERIFIED`, `INTENTIONAL_DIVERGENCE`, `UNVERIFIABLE_PUBLICLY`.

Do not leave launch-critical rows as `UNKNOWN`, `PARTIAL`, `TODO`, or `GAP` and still call the product live.
