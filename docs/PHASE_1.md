# Phase 1 — File provenance and metadata hygiene

## Implemented

- Local file inspection for JPEG, PNG, WebP, DOCX and PDF.
- JPEG detection of EXIF, XMP, IPTC, comments, and APP11/JUMBF provenance candidates.
- PNG detection of EXIF, textual metadata, timestamps, and C2PA `caBX` chunks.
- WebP detection of EXIF/XMP and conservative provenance-chunk candidates.
- DOCX inspection of core, application, and custom Office properties.
- PDF document-info/XMP/provenance heuristic inspection.
- Sanitized JPEG/PNG/WebP/DOCX outputs.
- Mandatory post-sanitize re-scan before download.
- Provenance manifests are preserved by default.
- PDF remains inspection-only until a structure-aware rewrite implementation is added.

## Safety and product semantics

“Sanitize” means remove tracked privacy/authoring metadata that the engine can deterministically identify and verify. It does **not** mean detector-proof, provenance-free, or anonymous. Signed provenance markers are deliberately not removed by the default sanitizer.

## Next wave

1. Add structured C2PA verification using a maintained Content Credentials implementation.
2. Add richer EXIF/XMP field-level previews rather than category-only findings.
3. Add a structure-aware PDF metadata writer and signature warnings.
4. Add before/after binary receipts with hashes.
5. Add batch processing and exported JSON receipts.
6. Add Supabase auth and a durable receipt history only after explicit opt-in.
