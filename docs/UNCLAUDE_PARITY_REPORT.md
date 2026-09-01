# Un-Claude Clean-Room Parity Report

This report records implementation evidence for the feature-parity branch. It intentionally documents behavioral parity rather than copying source code, branding, protected copy, or private implementation details.

## Baseline

- Base branch: `controlled-launch-verification`
- Base head at branch creation: `b8241784dbf9075cb7b2d1c250113de2922ef14c`
- Parity branch: `full-unclaude-feature-parity`
- Stripe: TEST MODE ONLY
- Supabase: `cikxzxxreryycfjumwsd`
- Vercel project: `provenance-cleaner`

## Intentional divergences

1. **Signed C2PA/provenance integrity** — Provenance Cleaner does not silently strip a cryptographically signed provenance binding and then imply that provenance remains valid. Signed provenance remains inspection-first with explicit integrity consequences.
2. **Brand/copy/assets** — all Provenance Cleaner branding, design, copy and assets remain original.
3. **Unsupported detection claims** — no claim of guaranteed detector bypass, undetectability, or verified watermark removal without an actual public verifier.
4. **Press/vendor claims** — no press logos or vendor status claims are copied without independent evidence.

## Implementation evidence

Evidence will be appended here as parity features move from OBSERVED/IMPLEMENTED to VERIFIED.
