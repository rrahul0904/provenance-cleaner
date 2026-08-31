# Phase 1 — File provenance and metadata hygiene

## Implemented

- Local file inspection for JPEG, PNG, WebP, DOCX and PDF.
- JPEG detection of EXIF, XMP, IPTC, comments, and APP11/JUMBF provenance candidates.
- PNG detection of EXIF, textual metadata, timestamps, and C2PA `caBX` chunks.
- WebP detection of EXIF/XMP and conservative provenance-chunk candidates.
- DOCX inspection of core, application, and custom Office properties.
- PDF document-info/XMP/provenance heuristic inspection.
- Sanitized JPEG/PNG/WebP/DOCX outputs when no provenance candidate is present.
- Mandatory post-sanitize re-scan before download.
- Provenance-bearing assets are inspection-only by default.
- PDF remains inspection-only until a structure-aware rewrite implementation is added.

## Safety and product semantics

“Sanitize” means remove tracked privacy/authoring metadata that the engine can deterministically identify and verify. It does **not** mean detector-proof, provenance-free, or anonymous.

A critical rule is that copying a provenance metadata block into a rewritten asset does not guarantee that its cryptographic hard binding remains valid. Therefore Phase 1 blocks sanitization whenever a provenance candidate is detected. Phase 2 adds official C2PA verification so those candidates can be classified properly before any future edit policy is considered.

## Next wave

1. Add structured C2PA verification using the official Content Authenticity Initiative browser SDK.
2. Add SHA-256 before/after receipts and downloadable JSON verification receipts.
3. Add richer EXIF/XMP field-level previews rather than category-only findings.
4. Add a structure-aware PDF metadata writer only where signature/provenance safety can be demonstrated.
5. Add batch processing with bounded concurrency.
6. Add Supabase auth and durable receipt history only after explicit opt-in.
