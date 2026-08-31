# Provenance Cleaner

Working implementation inspired by the product mechanics reverse-engineered from Un-Claude, but positioned as an **AI provenance and content-hygiene platform** rather than an AI-detector bypass tool.

## Phase 0 implemented

- Next.js 16.3.3 + React 19.2
- Browser-side Unicode provenance scanner
- Exact code-point findings with offsets and explanations
- Conservative sanitization mode
- Review-required handling for ZWJ/ZWNJ, bidi controls, Unicode tag characters, and typographic spaces
- Verification receipt model
- JSON `/api/scan` endpoint for future SDK/API usage
- Unit tests for safe removal and preservation behavior
- Responsive product UI

## Principles

1. **Deterministic before generative.** Provenance findings should be inspectable and reproducible.
2. **Do not corrupt language.** Invisible characters can be meaningful in RTL languages, Indic scripts, Persian, emoji, and typography.
3. **Do not claim detector-proof output.** Statistical watermark removal is not represented as verified unless a first-party detector exists.
4. **Receipts over promises.** Every transformation should report exactly what changed and what was preserved.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests

```bash
npm test
npm run build
```

## Roadmap

See `docs/ROADMAP.md` and `docs/ARCHITECTURE.md`.
