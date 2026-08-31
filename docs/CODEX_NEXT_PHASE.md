# Codex Next Phase — Phase 2

Continue from branch `phase-1-file-provenance`. Do not replace the deterministic text or file scanners.

## Goal

Add structured provenance verification and high-confidence metadata previews before introducing any generative rewrite feature.

## Required work

- Integrate a maintained C2PA/Content Credentials verifier behind an adapter interface.
- Distinguish valid, invalid, unverifiable and absent manifests.
- Add file hashing (SHA-256) to before/after receipts.
- Parse common EXIF/XMP fields into a safe preview with field names and values.
- Add downloadable JSON verification receipts.
- Add batch local processing with bounded concurrency.
- Implement structure-aware PDF metadata rewriting only if tests prove files remain readable; otherwise keep inspection-only.
- Preserve signed provenance by default.
- Do not claim watermark or detector bypass.
- Extend Vitest coverage and keep the app deployable on Vercel.
