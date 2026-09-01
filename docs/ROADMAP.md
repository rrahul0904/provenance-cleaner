# Implementation Roadmap

## Phase 0 — deterministic text scanner ✅
Exact Unicode detection, conservative cleaning, receipts, tests.

## Phase 1 — file provenance and metadata hygiene ✅
Local file inspection/sanitization, provenance modification guardrails, post-clean verification.

## Phase 2 — verified provenance ✅ code / deployment verification pending
Official C2PA browser verification, SHA-256 receipts, structured validation states.

## Phase 3 — semantic transformation ✅ code / live provider verification pending
Protected spans, chunking, AI Gateway editing, factual invariants, transparent metrics.

## Phase 4 — accounts and atomic credits ✅ code / database application pending
Supabase Auth, append-only ledger, reservations, Stripe test Checkout/webhooks, rate/spend economics.

## Phase 5 — production hardening ✅ implementation / external verification pending
Turnstile, burst limiting, request IDs, privacy-safe logs, hardened billing semantics, reconciliation, security headers, health/readiness, E2E/SQL tests, CI/runbooks.

## Next wave — controlled launch
Dedicated Supabase/Vercel projects, real preview verification, test-payment end-to-end validation, lockfile/CI green, operational dashboards and limited beta. Do not add API/CLI/teams until the launch gate is green.
