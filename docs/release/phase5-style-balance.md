# Phase 5 — StyleBalanceMeter

**Status:** Merged and CI verified; production verification remains blocked by the canonical deployment serving an older source revision.

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
| Protected CI and release certification | Passed. PR [#50](https://github.com/rrahul0904/provenance-cleaner/pull/50) merged as `3c35682edaadc1f7cfcbea64a7e80355f9ff7576`; `verify`, `e2e`, and `certify` passed, as did post-merge main CI run [38612240191](https://github.com/rrahul0904/provenance-cleaner/actions/runs/38612240191) |
| Production | Failed exact-source verification. For the merged release commit, production expected SHA `3c35682edaadc1f7cfcbea64a7e80355f9ff7576` and source hash `6887ecf2e73b20f6e3f1fdbe242e26e01f6d6c9f037f408f985179dce616fa6d`; canonical production reports SHA `173074b71130fc08051ac86bee43dd6b0c33e2ef` and source hash `3e7bc99180c04a743b22fcf09e36868be59473aa55c4a081778d9503acd54e17`. Health is `ok` and readiness is `ready`, but production is not verified. The GitHub `production` environment has no configured secrets; the controlled Vercel workflow requires `VERCEL_TOKEN`. |

See [the donor analysis](../reverse-engineering/quiron-style-balance-meter.md) for the clean-room boundary and [the Phase 4 receipt](phase4-safe-transformation.md) for the deployed-source blocker.
