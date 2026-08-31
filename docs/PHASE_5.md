# Phase 5 — Production hardening

## Implemented

- server-verified Cloudflare Turnstile adapter with explicit non-production bypass only
- Turnstile protection on guest creation, semantic editing and Checkout creation
- best-effort application burst limiting keyed by salted hashes; no raw IP persistence
- database reservation/request/24-hour credit limits remain authoritative for economic safety
- consistent API error envelope and request correlation IDs
- bounded JSON/webhook bodies and strict content-type/schema validation
- privacy-safe structured operational events with defensive redaction
- Stripe test-mode-only guard and reduced Checkout metadata
- bounded stale-reservation reconciliation endpoint + Vercel cron definition
- hardened duplicate/expired Checkout RPC semantics
- health and configuration-only readiness endpoints
- CSP/security headers compatible with Turnstile and C2PA WebAssembly
- Playwright Chromium E2E coverage using mocks/test bypasses; no real payments or model calls
- executable Supabase billing contract test script for a dedicated test project

## Intentionally not applied

No live Supabase schema was changed because the only connected project remains generically named. No Vercel preview exists because the repo is not linked to a Vercel project. No Stripe credentials or live charges were configured.

## Known verification blocker

GitHub Actions previously created jobs with runner_id=0 and no steps. A rewritten two-job CI workflow is included, but it is only considered verified if GitHub actually assigns a runner and executes the commands.

## Dependency lockfile

Direct dependencies are pinned. A `package-lock.json` could not be generated in the available execution environment because package installation did not complete, and GitHub Actions has not been assigning a runner. Do not fabricate a lockfile. Generate it with Node 22.22+ using `npm install --package-lock-only`, commit it, then switch CI installs to `npm ci`.
