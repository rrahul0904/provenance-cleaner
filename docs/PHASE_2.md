# Phase 2 — Verified provenance

## Goal

Replace heuristic-only provenance reporting with a layered model:

1. fast deterministic container/metadata inspection
2. cryptographic C2PA verification on demand
3. immutable file hashes in receipts
4. explicit edit policy based on provenance risk

## Implemented

- Official `@contentauth/c2pa-web` browser SDK integration using the inline Wasm build.
- Lazy loading so the large verifier is not part of the initial interaction path.
- `verifyTrust: true` on verification reads.
- Explicit handling for assets with no C2PA reader/manifest.
- Normalized statuses:
  - `valid`
  - `invalid`
  - `untrusted`
  - `unverifiable`
  - `not_present`
  - `unsupported`
- SHA-256 hashing for original and sanitized bytes.
- Downloadable `file-verification-v2` JSON receipts.
- Receipts store findings, hashes and verification state; they never embed the raw asset.
- Provenance-bearing assets remain non-sanitizable by default.

## Validation semantics

`valid` means the official SDK returned a manifest and the normalized manifest store contains no validation failure statuses. `untrusted` is kept separate from `invalid`: an asset can be cryptographically intact while the signing credential is not trusted under the current trust configuration.

Unknown warning/status codes are reported as `unverifiable` rather than being guessed into a pass/fail state.

## Important edit rule

C2PA uses hard bindings between manifests and asset content. Preserving a JUMBF/caBX/APP11 metadata block while altering other bytes does not preserve validity. Therefore this project does not sanitize an asset after a provenance candidate is found. A future provenance-aware edit workflow should create a new valid provenance chain rather than silently carrying a stale signature forward.

## Next steps

1. Verify against official C2PA public test vectors in browser E2E tests.
2. Add field-level EXIF/XMP previews with redaction policy.
3. Add batch scanning with bounded concurrency and per-file receipts.
4. Add optional trustworthy provenance-preserving edit/sign workflow rather than provenance removal.
5. Add Supabase authentication and opt-in receipt history.
6. Add Stripe credit ledger only for compute-heavy optional features.
