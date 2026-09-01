# Provenance Cleaner

Working implementation inspired by the useful product mechanics reverse-engineered from Un-Claude, but positioned as an **AI provenance and content-hygiene platform** rather than an AI-detector bypass tool.

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

### Semantics-preserving editing — Phase 3
- Natural, clarity, concise, and formal editing modes
- Protected URLs, email addresses, dates, numbers, citations, quoted passages, and inline code
- Bounded chunk planner and maximum two generation attempts
- Vercel AI Gateway through AI SDK 7
- Default model `mistral/mistral-medium-3.5`, configurable with `TRANSFORM_MODEL`
- Deterministic rejection when protected spans or factual invariant values change
- Edit receipts with protected-span coverage, word/length change, longest shared phrase, and 3-gram overlap
- No raw-text persistence or application logging by design in this phase

## Principles

1. **Deterministic before generative.** Findings and validation should be inspectable and reproducible.
2. **Do not corrupt language.** Invisible characters can be meaningful in RTL languages, Indic scripts, Persian, emoji, and typography.
3. **Protect signed provenance.** Changing asset bytes can invalidate cryptographic hard bindings, so provenance-bearing assets are inspection-only by default.
4. **Preserve facts around generative edits.** Protected spans and factual invariants are validated after every AI edit.
5. **Do not claim detector-proof output.** Phrase overlap is reported for transparency, not minimized as an evasion target.
6. **Receipts over promises.** Every transformation should report what changed and what was preserved.

## Runtime

Node.js 22.22 or later is required by the current official C2PA JavaScript SDK and is compatible with AI SDK 7.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For semantic editing, link the project to Vercel and enable AI Gateway/OIDC, or provide a local `AI_GATEWAY_API_KEY`. See `.env.example` and `docs/PHASE_3.md`.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Roadmap

See `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/PHASE_1.md`, `docs/PHASE_2.md`, and `docs/PHASE_3.md`.
