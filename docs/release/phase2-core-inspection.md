# Phase 2 — Core inspection engine

**Status:** Source and local runtime verified; production deployment verification pending.
**Scope:** Deterministic text/Unicode scan and conservative/aggressive sanitation only.

## Contract

- Findings are code-point based and report UTF-16 source offsets, matching JavaScript text-area indices.
- `U+200B` and embedded `U+FEFF` remain the only automatically safe-to-remove findings.
- Bidi controls, language/emoji-sensitive joiners, unusual spaces, Unicode tags, soft hyphen, grapheme joiner, Mongolian vowel separator, and C0/C1 controls are review findings.
- Tab, line feed, carriage return, and U+0085 NEXT LINE are structural whitespace and remain unflagged.
- Conservative sanitation removes only safe findings. Aggressive sanitation removes review findings only after an explicit aggressive-mode request.
- Text is not normalized. Canonically equivalent input sequences remain byte/code-point distinct except for the explicitly removed findings.
- Deterministic receipt content is stable for a fixed input, version, and `scannedAt` value. `scannedAt` is caller-supplied or wall-clock receipt metadata; it is not part of Unicode classification.
- Explanations identify code point, category, source position, and whether the user may remove it safely or should review it.

## Added coverage

- Golden fixtures cover each tracked finding family and verify category/disposition stability.
- A complete C0/C1 range fixture checks every control value while excluding structural whitespace.
- Multilingual fixtures preserve Persian ZWNJ, Hindi ZWJ, and Arabic/BiDi marks.
- Hostile fixtures include NUL, DEL, C1 controls, directional overrides/isolates, zero-width characters, and Unicode tag-plane characters.
- Offset tests place findings after combining marks and supplementary-plane emoji.
- Normalization tests prove decomposed accents remain decomposed after sanitation.
- Browser coverage confirms a C1 control appears as a review finding and is not silently cleaned.

## Verification receipt

| Check | Result |
| --- | --- |
| Vitest | 206 tests across 31 files passed |
| ESLint | Passed |
| Chromium Playwright | 41 E2E tests passed locally on isolated port 3101 |
| Next.js production build | Passed |
| Deployed production browser journey | Not performed; the canonical deployment still serves the prior source SHA |

The classifier is deterministic and all local CI checks pass. Phase 2 does not certify file parsers, provenance signatures, customer account/billing flows, or production deployment. Those remain later phase gates.
