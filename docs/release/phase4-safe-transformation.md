# Phase 4 — Safe transformation engine

**Status:** User-locked spans and explicit review state implemented; production verification pending.

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
| Source manifest / protected CI | Pending for this slice |
| Production verification | Blocked by the Vercel release credential/source mismatch; the canonical deployment still serves SHA `173074b71130fc08051ac86bee43dd6b0c33e2ef` |

The feature is locally and automatically testable but is not production verified. See [the current-state audit](current-state-audit.md) for the release-path constraint.
