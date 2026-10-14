# Phase 3 — Provenance and file engine

**Status:** Bounded hardening implemented; full Phase 3 exit gate remains in progress.

## Verified contracts

- Supported file sanitation preserves signed provenance candidates and blocks destructive changes.
- DOCX inspection requires `[Content_Types].xml` and `word/document.xml`, enforces archive entry, expansion, and compression-ratio limits, and rejects malformed packages before billing.
- Office package signature parts under `_xmlsignatures/` or a digital-signature content type are reported as provenance and block sanitation.
- PNG inspection requires a first 13-byte `IHDR`, bounded chunks, a zero-length `IEND`, and no trailing bytes.
- JPEG inspection rejects invalid segment lengths and missing/trailing end markers.
- WebP inspection requires its RIFF byte length and chunk boundaries to match the file.
- PDF remains inspection-only; sanitation is disabled to preserve signatures and structural integrity.
- C2PA-related image chunks remain candidates, not cryptographic validation claims; official verification is a separate browser flow.

## Added regression coverage

- Signed DOCX packages cannot be sanitized.
- Non-DOCX ZIP archives with a `.docx` name are rejected.
- Truncated PNG chunks, missing IEND, malformed JPEG segments, missing JPEG EOI, and mismatched WebP RIFF lengths fail closed.
- Browser file inspection surfaces malformed PNG structure and leaves sanitation unavailable.

## Verification receipt

| Check | Result |
| --- | --- |
| Vitest | 212 tests across 31 files passed |
| ESLint | Passed |
| Next.js production build | Passed |
| Chromium Playwright | 42 tests passed locally on port 3101 with two workers |
| File round-trip fixtures | JPEG, PNG, WebP, and DOCX sanitation/reinspection paths covered; PDF remains inspection-only |
| Source manifest / PR CI | Pending for this Phase 3 slice |
| Production verification | Blocked: production still serves SHA `173074b71130fc08051ac86bee43dd6b0c33e2ef`; merged main is `51247577287ca126b9c42fbc4b9092ba1e24fdc2` |

## Exit-gate status

Synthetic round-trip fixtures cover the sanitizable formats. Real-world fixture coverage, a direct malformed-file API assertion, and deployed production verification remain pending. The post-merge production-integrity workflow reports the same deployed source hash `3e7bc99180c04a743b22fcf09e36868be59473aa55c4a081778d9503acd54e17` against main's expected source hash `877cc88a8cd1f1314ddddcd0222ddd8b03fe6c9f9aebf12e5b382f97e7917923`. Production readiness is not claimed.
