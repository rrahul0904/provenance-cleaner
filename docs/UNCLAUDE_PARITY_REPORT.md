# Un-Claude Clean-Room Parity Report

Updated: 2026-09-21

This report records the current resolved state of the clean-room parity work. Historical audit documents remain in the repository as dated evidence of earlier gaps; this file and `docs/UNCLAUDE_FEATURE_PARITY.md` are the current release-facing parity sources.

## Current accounting

- Total known public/behavioral contract rows: **35**
- VERIFIED: **29**
- INTENTIONAL_DIVERGENCE: **5**
- UNVERIFIABLE_PUBLICLY: **1**
- Known implementation gaps: **0**

## Intentional divergences

1. **Signed C2PA/provenance integrity** — Provenance Cleaner does not silently strip a cryptographically signed provenance binding and then imply that provenance remains valid.
2. **Language/emoji integrity** — controls such as ZWJ/ZWNJ/BiDi/tag-plane/typographic spaces are detected but preserved for review by default when automatic deletion could alter legitimate text.
3. **Analytics** — product analytics is disabled rather than enabling tracking solely to mimic another product.
4. **Brand/vendor evidence** — no copied press logos, vendor claims, trade dress or unsupported third-party status claims.
5. **Detector-bypass claims** — no guaranteed “undetectable” or verified statistical-watermark-removal claim without a legitimate detector.

## Publicly unverifiable item

The exact current reference contract for a one-year guest browser cookie/session cannot be independently re-probed because the public reference capabilities page is not directly reachable from the verification environment. Provenance Cleaner guest/session behavior itself is implemented and independently tested.

## Current implementation evidence

The former gaps are now represented in source/tests, including:

- TXT routing and shared credit arithmetic;
- 3.2 MiB file and 8,000-word rewrite boundaries;
- unified sanitization job orchestration;
- parity transform mode and factual invariant protection;
- signed numeric/currency/percentage/entity protection;
- rewrite receipts/metrics;
- explicit unavailable text-watermark verifier;
- lazy guest +2 and signup +3 controls;
- FIFO purchased-credit refund accounting;
- controlled deletion reconciliation;
- US-restricted TEST Checkout;
- pricing calculator;
- mailto-only contact;
- mobile/responsive/keyboard contracts;
- privacy-safe server sanitation/logging/history.

See `docs/FINAL_REFERENCE_PARITY.md`, `docs/REFERENCE_BEHAVIOR_SPEC.md`, `docs/UNICODE_REFERENCE_AUDIT.md` and `tests/unclaude-parity.test.ts`.

## Release rule

A known parity row may only be `VERIFIED`, `INTENTIONAL_DIVERGENCE`, or `UNVERIFIABLE_PUBLICLY`. The unit suite fails if unresolved legacy status markers are reintroduced into the parity matrix.
