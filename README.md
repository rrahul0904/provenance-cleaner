# Provenance Cleaner

An **AI provenance and content-hygiene platform** inspired by mechanics reverse-engineered from Un-Claude, but intentionally not positioned as an AI-detector bypass product.

## Implemented
- Deterministic Unicode inspection and conservative text hygiene.
- JPEG/PNG/WebP/DOCX/PDF metadata and provenance inspection.
- Official C2PA verification, SHA-256 receipts, and provenance-safe editing guardrails.
- Semantics-preserving editing with protected facts and deterministic validation.
- Supabase guest/account sessions.
- Append-only credits with atomic reserve/commit/release semantics.
- Fixed credit packs, Stripe-hosted Checkout, signed webhook reconciliation, and server-side usage limits.
- No raw text stored in billing records.

## Principles
1. Deterministic before generative.
2. Do not corrupt language.
3. Protect signed provenance.
4. Charge only after validated success.
5. Do not claim detector-proof output.
6. Receipts over promises.

## Runtime
Node.js 22.22 or later.

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Phase 4 database SQL is staged at `supabase/schema/phase_4_accounts_credits.sql` until a dedicated Supabase project is explicitly linked.

See `docs/ROADMAP.md`, `docs/PHASE_1.md`, `docs/PHASE_2.md`, `docs/PHASE_3.md`, and `docs/PHASE_4.md`.
