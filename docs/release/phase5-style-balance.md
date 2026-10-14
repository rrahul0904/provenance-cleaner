# Phase 5 — StyleBalanceMeter

**Status:** Implemented and locally certified; production verification remains unavailable until the exact-source deployment blocker is cleared.

## Contract

- The meter is descriptive and deterministic. It reports 13 explainable structure and punctuation metrics, range position, and insufficient-evidence states; it never classifies authorship or claims detector resistance.
- Synthetic comparison bands use independently authored examples listed in `docs/style-balance-provenance.json`. Writer calibration is ephemeral, bound to one user and operation, expires within one hour, and contains aggregate bands rather than the raw sample or a sample digest.
- Measurement normalizes NFC and line endings while receipts retain hashes for both original and normalized input.
- Before/after comparisons reject changes to protected facts and emit a self-verifying receipt with profile, meter and normalization versions, measurements, hashes, and overshoot warnings.
- Local browser measurement requires no network request. Web and `/api/v1/transform` results carry the comparison in the transform receipt; the CLI prints the same versioned API result as JSON.

## Regression coverage

- Deterministic normalization, profile construction, measurements and receipt hashes.
- Insufficient evidence, unsupported versions, malformed bounds, protected-fact mutation, and numeric bounds.
- Writer-profile expiry and user/operation isolation; exported receipts contain no raw writer sample and can be independently re-verified.
- Developer API transform integration verifies the returned style receipt against the source and output; Playwright checks the local UI’s explainable measurements and non-authorship language.

## Verification receipt

| Check | Result |
| --- | --- |
| StyleBalanceMeter unit suite | 27 tests passed |
| Developer API route integration | Covered by `tests/security-route-behavior.test.ts`; style receipt re-verification added in this phase |
| Browser UI | `style balance provides local, bounded measurements without authorship labels` passed in Chromium CI |
| Protected CI and release certification | Pending for this documentation/test slice |
| Production | Not verified; current-state exact-source deployment blocker remains |

See [the donor analysis](../reverse-engineering/quiron-style-balance-meter.md) for the clean-room boundary and [the Phase 4 receipt](phase4-safe-transformation.md) for the deployed-source blocker.
