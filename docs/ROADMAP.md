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

## Phase 3 — semantics-preserving editing 🚧

- protected-span extraction for quotes, URLs, emails, numbers, dates, citations and inline code
- bounded chunk/section planner
- Vercel AI Gateway via AI SDK 7
- configurable Mistral editing model
- protected-token and factual-invariant validation
- mode-specific length guardrails
- transparent n-gram/longest-shared-phrase receipt metrics
- maximum two attempts on validation failure
- browser E2E/model integration verification pending
- dedicated named-entity and semantic-similarity validation still pending
- no detector-proof or guaranteed watermark-removal claims

## Phase 4 — accounts, credits and abuse controls

- Supabase Auth
- PostgreSQL operation ledger
- atomic credit debit/refund
- guest credits
- Stripe checkout + webhook reconciliation
- per-user/IP AI rate limits and cost ceilings
- operation metadata/history without raw document bodies

## Phase 5 — production hardening

- Cloudflare Turnstile / abuse controls
- structured redacted logs
- privacy-preserving analytics
- deletion guarantees
- browser integration/e2e tests
- Vercel preview and production deployment
- security review of model/provider retention configuration

## Phase 6 — platform expansion

- API keys
- CLI
- batch jobs
- browser extension
- team policies
- provenance gateway for enterprise uploads
