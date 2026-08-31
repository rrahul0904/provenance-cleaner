# Implementation Roadmap

## Phase 0 — deterministic text scanner ✅

- exact Unicode detection
- conservative cleaning
- verification receipts
- local-first UI
- tests

## Phase 1 — file provenance and metadata hygiene ✅

- JPEG/PNG/WebP metadata inspection
- DOCX core/app/custom property inspection
- PDF metadata inspection
- sanitize-to-new-file workflow for non-provenance assets
- post-sanitize re-scan
- provenance-bearing assets blocked from modification by default

## Phase 2 — verified provenance 🚧

- official `@contentauth/c2pa-web` verification
- structured validation states
- SHA-256 before/after hashes
- downloadable JSON verification receipts
- separation of heuristic candidates from cryptographic verification
- browser E2E validation against official C2PA public test vectors pending

## Phase 3 — semantic transformation engine

- protected-span extraction: quotes, URLs, numbers, dates, citations
- chunk/section planner
- optional non-origin model via Vercel AI Gateway
- entity/numeric/date invariants
- semantic similarity guardrails
- n-gram overlap receipt
- section-only retry on validator failure
- no detector-proof or guaranteed watermark-removal claims

## Phase 4 — accounts and credits

- Supabase Auth
- PostgreSQL operation ledger
- atomic credit debit/refund
- guest credits
- Stripe checkout + webhook reconciliation

## Phase 5 — production hardening

- Cloudflare Turnstile / abuse controls
- rate limits
- structured redacted logs
- privacy-preserving analytics
- deletion guarantees
- browser integration/e2e tests
- Vercel deployment

## Phase 6 — platform expansion

- API keys
- CLI
- batch jobs
- browser extension
- team policies
- provenance gateway for enterprise uploads
