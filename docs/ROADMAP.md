# Implementation Roadmap

## Phase 0 — deterministic text scanner ✅

- exact Unicode detection
- conservative cleaning
- verification receipts
- local-first UI
- tests

## Phase 1 — file provenance engine

- upload pipeline with size/type validation
- PNG/JPEG/WebP EXIF + XMP inspection
- C2PA manifest inspection
- DOCX core/app/custom property inspection
- PDF metadata inspection
- sanitize-to-new-file workflow
- post-sanitize re-scan proving metadata state

## Phase 2 — rewrite engine

- protected-span extraction: quotes, URLs, numbers, dates, citations
- chunk/section planner
- non-origin model via Vercel AI Gateway
- entity/numeric/date invariants
- semantic similarity guardrails
- n-gram overlap receipt
- section-only retry on validator failure

## Phase 3 — accounts and credits

- Supabase Auth
- PostgreSQL operation ledger
- atomic credit debit/refund
- guest credits
- Stripe checkout + webhook reconciliation

## Phase 4 — production hardening

- Cloudflare Turnstile / abuse controls
- rate limits
- structured redacted logs
- Sentry/PostHog instrumentation
- deletion guarantees
- integration/e2e tests
- Vercel deployment

## Phase 5 — platform expansion

- API keys
- CLI
- batch jobs
- browser extension
- team policies
- provenance gateway for enterprise uploads
