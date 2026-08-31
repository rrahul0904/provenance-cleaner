# Implementation Roadmap

## Phase 0 — deterministic text scanner ✅
## Phase 1 — file provenance and metadata hygiene ✅
## Phase 2 — verified provenance 🚧
Official C2PA verification is implemented; public browser E2E vectors remain pending.

## Phase 3 — semantic transformation engine ✅
Protected spans, AI Gateway, factual invariants, transparent metrics, bounded retry.

## Phase 4 — accounts and credits 🚧
- Supabase SSR auth and anonymous sessions
- append-only credit ledger
- atomic reservation/commit/release
- fixed credit packs
- Stripe Checkout/webhook boundaries
- per-user rate and spend controls
- staged SQL pending a dedicated linked Supabase project
- live Stripe/Supabase integration tests pending

## Phase 5 — production hardening
- Cloudflare Turnstile / bot controls
- durable redacted logs and privacy-preserving analytics
- stronger request/IP abuse controls
- webhook replay/integration tests
- browser E2E
- Vercel preview and production deployment

## Phase 6 — platform expansion
API keys, CLI, batch jobs, browser extension, team policies, enterprise provenance gateway.
