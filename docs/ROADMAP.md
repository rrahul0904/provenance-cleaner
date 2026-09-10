# Implementation Roadmap

## Phase 0 — deterministic text scanner ✅
Exact Unicode detection, conservative cleaning, receipts and regression tests.

## Phase 1 — file provenance and metadata hygiene ✅
Local inspection plus safe sanitation for supported image/DOCX formats, provenance guardrails and post-clean verification. PDF remains inspection-only by product policy.

## Phase 2 — verified provenance ✅
Official C2PA browser verification, SHA-256 receipts, structured validation states and signed-provenance mutation blocking.

## Phase 3 — semantic transformation ✅
Protected spans, chunking, AI Gateway editing, factual invariants, bounded retries, receipts and stale-request protection.

## Phase 4 — accounts and atomic credits ✅
Supabase anonymous/registered auth, append-only FIFO ledger, reservations, one-time Stripe TEST Checkout/webhooks and authoritative spend economics.

## Phase 5 — production hardening ✅
Turnstile, rate limits, request IDs, privacy-safe logs, reconciliation, security headers, health/readiness, Playwright and CI.

## Phase 6 — privacy/accounting parity ✅
FIFO purchase lots, signup/guest promo controls, refund accounting, privacy-safe job history and controlled deletion reconciliation.

## Phase 7 — Admin, FinOps and subscriptions ✅
Private RBAC, operational rollups, cost evidence, Stripe TEST subscriptions, invoice-authoritative monthly grants and Billing Portal.

## Phase 8 — release hardening ✅ source / runtime certification in progress
Readiness contracts, deletion safety, Stripe reconciliation hardening, Admin owner bootstrap, TEST revenue/MRR evidence and exact-SHA deployment controls.

## Release certification
A release is complete only after the final branch is merged, the corresponding database migration is applied and verified, security/readiness checks pass, live Preview smoke is green, and the exact final `main` SHA is deployed and verified in Production.
