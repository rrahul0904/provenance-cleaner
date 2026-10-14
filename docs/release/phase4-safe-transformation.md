# Phase 4 — Safe transformation engine

**Status:** Merged and CI verified; production verification blocked by the canonical deployment serving an older source revision.

## Contract

- The source textarea can lock up to 20 non-overlapping selections for one edit.
- Locks use UTF-16 ranges matching textarea selection offsets. Any source edit clears the ranges so stale offsets cannot protect different text.
- The server validates every range against the submitted source, rejects overlaps and out-of-bounds ranges before identity, billing, or model work, then replaces selected text with protected placeholders.
- Locked spans pass through the same exactly-once placeholder validation as detected facts and are restored only after validation succeeds. If a lock overlaps an automatically protected fact or quotation, the full overlapping range is protected as one token while the receipt tracks both kinds of checks.
- The receipt reports expected and preserved user-locked spans separately from numeric/date/entity and quote/reference checks.
- A `validation_failed` response enters the visible `NEEDS_REVIEW` state. The source remains unchanged and the server releases the credit hold.

## Regression coverage

- Deterministic unit fixtures cover exact locked text restoration and malformed, out-of-range, and overlapping ranges.
- Browser coverage checks the selection offsets sent to the server, preserved output, and the lock count in the receipt.
- Browser coverage checks that failed preservation validation enters `NEEDS_REVIEW`, keeps the source text intact, and displays the released-hold message.

## Verification receipt

| Check | Result |
| --- | --- |
| Vitest | 215 tests across 31 files passed |
| ESLint | Passed |
| Next.js production build | Passed |
| Chromium Playwright | 44 tests passed locally on port 3101 with two workers |
| Source manifest / protected CI | Passed. PR [#48](https://github.com/rrahul0904/provenance-cleaner/pull/48) merged as `db8d4cfed3b7246cbf17fcddcb9d8da832ec2b6d`; `verify`, `e2e`, and `certify` passed, as did post-merge main CI run [38610336925](https://github.com/rrahul0904/provenance-cleaner/actions/runs/38610336925) |
| Production verification | Failed exact-source verification. Expected SHA `db8d4cfed3b7246cbf17fcddcb9d8da832ec2b6d` and source hash `7a5067986f650a0b111b3a8cbc40eb9dd2d47b2db1f60bdd00d4b82911fb8f76`; canonical production still reports SHA `173074b71130fc08051ac86bee43dd6b0c33e2ef` and source hash `3e7bc99180c04a743b22fcf09e36868be59473aa55c4a081778d9503acd54e17`. Health is `ok` and readiness is `ready`, but production is not verified. The GitHub `production` environment lacks the Vercel deployment credential required for controlled release. |

The feature is merged and CI verified but is not production verified. See [the current-state audit](current-state-audit.md) for the release-path constraint.
