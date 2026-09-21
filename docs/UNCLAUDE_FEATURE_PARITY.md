# Un-Claude Clean-Room Feature Parity Matrix

This is the release-facing inventory for the publicly observable Un-Claude behavior captured during clean-room reverse engineering. It does not copy proprietary source, branding, protected copy, assets, or private implementation details.

Status meanings:

- `VERIFIED`: implementation exists and is covered by source/unit/browser/database/runtime evidence.
- `INTENTIONAL_DIVERGENCE`: Provenance Cleaner deliberately uses a safer or more truthful contract.
- `UNVERIFIABLE_PUBLICLY`: the exact reference behavior cannot currently be independently re-probed; no known implementation defect is implied.

No launch-critical row may remain `OBSERVED`, `PARTIAL`, `GAP`, `UNKNOWN`, or `TODO`.

| ID | Surface | Resolved Provenance Cleaner behavior | Primary evidence | Status |
| --- | --- | --- | --- | --- |
| PAR-001 | Workbench | Unified Text / Files / Rewrite / Artifacts workbench with account state, receipts, copy/download flows | `src/components/unified-workbench.tsx`; `tests/e2e/core.spec.ts` | VERIFIED |
| PAR-002 | Scan | Hidden-character scan is free, local-first, and does not require an account | `scanner-workbench.tsx`; core/offline E2E | VERIFIED |
| PAR-003 | Text | Pasted text supports deterministic sanitation and optional protected semantic rewrite | text sanitize + transform routes | VERIFIED |
| PAR-004 | TXT | TXT follows the text pipeline and word-based pricing | `product-contract.ts`; economics-boundaries E2E | VERIFIED |
| PAR-005 | DOCX | Office metadata/hidden-character inspection and safe sanitation; no automatic semantic rewrite | DOCX engine/tests + file route | VERIFIED |
| PAR-006 | PNG/JPG | Metadata inspection and server-authoritative safe sanitation | file engine/tests + core E2E | VERIFIED |
| PAR-007 | Limits | DOCX/PNG/JPG 3.2 MiB maximum; semantic rewrite 8,000-word maximum | `product-contract.ts`; boundary tests | VERIFIED |
| PAR-008 | Unicode | Detects/remediates zero-width and related invisible controls while preserving language/emoji-sensitive controls for review | `provenance/unicode.ts`; Unicode + parity tests | INTENTIONAL_DIVERGENCE |
| PAR-009 | Metadata | EXIF/XMP/IPTC/comments/Office properties/generator-style metadata are inspected and removable findings are re-verified after cleaning | file engine/tests | VERIFIED |
| PAR-010 | C2PA | Signed provenance is verified/identified and destructive sanitation is blocked instead of silently invalidating the signature | C2PA/file tests + sanitize route | INTENTIONAL_DIVERGENCE |
| PAR-011 | Rewrite | Explicit parity mode performs substantive semantics-preserving rewrite with protected spans and bounded validation/retry | transform route/validate tests | VERIFIED |
| PAR-012 | Rewrite metrics | Receipt includes source/output words, retained %, wording replaced %, longest unprotected shared run, protected checks, model and attempts | transform types/metrics + UI E2E | VERIFIED |
| PAR-013 | Guest | Signed-out identity is created lazily when a billable action needs authoritative state | anonymous + transform routes | VERIFIED |
| PAR-014 | Guest promo | First guest clean/edit grants +2 credits once through idempotent billing state | Phase 6 billing + E2E | VERIFIED |
| PAR-015 | Signup promo | Genuine signup/upgrade grants +3 credits once with keyed anti-abuse fingerprint; ordinary sign-in does not | auth callback + Phase 6 schema/tests | VERIFIED |
| PAR-016 | Guest migration | Guest-to-account upgrade preserves identity/credits/history rather than creating duplicate economic state | auth architecture + Phase 6 | VERIFIED |
| PAR-017 | Guest persistence | Browser guest identity persists through Supabase session semantics; the exact current reference one-year cookie contract cannot be independently re-probed | guest-session preview test/runbook | UNVERIFIABLE_PUBLICLY |
| PAR-018 | Auth | Email/password, password update/reset path, sign in/out and Google/OAuth when configured | auth pages/routes + E2E | VERIFIED |
| PAR-019 | Account | Credit balance/history, purchases, subscriptions/API keys, refund and deletion operations | account APIs/UI | VERIFIED |
| PAR-020 | History privacy | Operational metadata only; no intentional source text, file bytes, or filenames in account history | Phase 6 + privacy tests | VERIFIED |
| PAR-021 | Delete | Controlled account deletion cancels linked subscriptions and safely reconciles retained accounting/anti-abuse records | account delete route + Phase 6/8 tests | VERIFIED |
| PAR-022 | Pricing | Text/TXT 1 credit per 1,000 words rounded up; DOCX/PNG/JPEG 1 credit; free inspection remains zero-credit | shared product contract | VERIFIED |
| PAR-023 | Packs | One-time TEST-mode packs remain 10/$4.99, 25/$9.99, 100/$24.99 | billing catalog + parity test | VERIFIED |
| PAR-024 | Failure billing | reserve → work → validate → commit; failures release/expire holds | billing + sanitation/transform routes | VERIFIED |
| PAR-025 | US paid policy | One-time Checkout collects address and restricts shipping country to US; reconciliation covers policy failures | checkout/webhook + Stripe tests | VERIFIED |
| PAR-026 | Refunds | Unused purchased credits are refundable within 30 days using FIFO lot accounting and Stripe idempotency | refund route + Phase 6 tests | VERIFIED |
| PAR-027 | Pricing calculator | Interactive calculator uses shared authoritative pricing arithmetic and surfaces limits | `pricing-calculator.tsx` | VERIFIED |
| PAR-028 | Public pages | How it works, Capabilities, Mission, Pricing, FAQ, Contact, Privacy, Terms, Cookies and Auth/Account surfaces | public-route E2E | VERIFIED |
| PAR-029 | Contact | Contact form creates a `mailto:` draft and never POSTs message content to the application | contact component + privacy-ui E2E | VERIFIED |
| PAR-030 | Analytics | Product analytics is deliberately disabled rather than silently tracking users; future analytics must be cookieless/memoryless and DNT-safe | privacy policy/architecture | INTENTIONAL_DIVERGENCE |
| PAR-031 | Bot protection | Turnstile protects economic actions with fail-closed server verification and rate limits | abuse/server tests + routes | VERIFIED |
| PAR-032 | Privacy | Local inspection; ephemeral billable sanitation; model access only after explicit edit; privacy-safe logs/history | privacy architecture + privacy tests | VERIFIED |
| PAR-033 | Marketing evidence | No copied press logos/vendor claims; only independently supportable product claims are published | public copy + security/release review | INTENTIONAL_DIVERGENCE |
| PAR-034 | Safety claims | No guaranteed detector-bypass, “undetectable,” or statistical-watermark-removal claim without a legitimate verifier | watermark abstraction + capabilities page | INTENTIONAL_DIVERGENCE |
| PAR-035 | Mobile/a11y | Responsive launch routes, mobile navigation, main landmarks, no horizontal overflow, keyboard reachability and async live regions | `privacy-ui.spec.ts` | VERIFIED |

## Resolution count

- Total known behaviors: **35**
- VERIFIED: **29**
- INTENTIONAL_DIVERGENCE: **5**
- UNVERIFIABLE_PUBLICLY: **1**
- Known implementation gaps: **0**

The one unverifiable item is an exact reference-session-duration detail, not a missing user-facing core capability. If the public reference becomes directly reachable again, re-probe that item and any newly exposed behavior before changing these counts.
