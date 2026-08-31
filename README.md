# Provenance Cleaner

Working implementation inspired by the product mechanics reverse-engineered from Un-Claude, but positioned as an **AI provenance and content-hygiene platform** rather than an AI-detector bypass tool.

## Implemented

### Deterministic text hygiene
- Browser-side Unicode provenance scanner
- Exact code-point findings with offsets and explanations
- Conservative sanitization with review-required handling for linguistically meaningful controls
- JSON `/api/scan` endpoint

### File provenance and privacy metadata
- Local JPEG/PNG/WebP/DOCX/PDF inspection
- JPEG/PNG/WebP/DOCX privacy-metadata sanitization when no provenance candidate is present
- PDF inspection-only guardrail
- Provenance-bearing assets protected from modification by default
- Mandatory post-sanitize re-scan

### Verified provenance — Phase 2
- Official `@contentauth/c2pa-web` browser verifier, lazy-loaded on demand
- Structured C2PA states: valid, invalid, untrusted, unverifiable, not present, unsupported
- SHA-256 hash for the original and sanitized asset
- Downloadable JSON verification receipts containing hashes and findings, never raw content
- Separate cryptographic validation from heuristic provenance-candidate detection

## Principles

1. **Deterministic before generative.** Findings should be inspectable and reproducible.
2. **Do not corrupt language.** Invisible characters can be meaningful in RTL languages, Indic scripts, Persian, emoji, and typography.
3. **Protect signed provenance.** Changing asset bytes can invalidate cryptographic hard bindings, so provenance-bearing assets are inspection-only by default.
4. **Do not claim detector-proof output.** Statistical watermark removal is not represented as verified unless a first-party detector exists.
5. **Receipts over promises.** Every transformation should report exactly what changed and what was preserved.

## Runtime

Node.js 22.22 or later is required by the current official C2PA JavaScript SDK.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Roadmap

See `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/PHASE_1.md`, and `docs/PHASE_2.md`.
