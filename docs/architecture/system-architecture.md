# System architecture

## As-built components

```text
Web workbench (Next.js / React)
├── local inspection: Unicode, supported file metadata, C2PA, hashes/receipts
├── account and public pages
├── route handlers: `/api/*` and `/api/v1/*`
└── MV3 extension and Node CLI as separate clients

Route handlers → domain modules (`src/lib`) → provider adapters
                                      ├── Supabase Auth / Postgres
                                      ├── Stripe (TEST)
                                      ├── Vercel AI Gateway / model
                                      ├── Cloudflare Turnstile
                                      └── PulseAtlas operational events

Vercel hosts the Next.js runtime and canonical production hostname.
```

## Responsibilities

- **Clients:** present explicit actions and trust state; never decide balances or entitlements.
- **Application/API:** authenticate and authorize, parse/validate requests, enforce same-origin rules, abuse controls, rate limits, API versioning and non-cacheable sensitive responses.
- **Domain:** Unicode and file inspection, provenance verification, sanitation, protected transformation, fact validation, StyleBalanceMeter, receipt generation, entitlement and credit operation rules.
- **Infrastructure adapters:** isolate Supabase, Stripe, model gateway, Turnstile, telemetry and hosting-specific behavior.
- **Database:** authoritative identity-linked ledger, holds, purchases/subscriptions, usage and hashed API-key material; migrations define schema evolution.

The code already has domain/provider modules, while route handlers still coordinate some multi-step business operations. Preserve current tested boundaries and extract services only when it improves a concrete testability, duplication, or recovery problem.

## Processing classes

1. **Deterministic:** local Unicode analysis, metadata parsing, hashing, receipt checks and style metrics. Same input and version should produce reproducible results.
2. **Statistical:** semantic model generation. Output is nondeterministic and must pass bounded validation before use.
3. **Provenance:** C2PA, embedded metadata, source/output hashes and receipts. A valid signature must not be silently invalidated.

## Deployment truth

At the time of the audit, production reported the then-current `main` commit and its source manifest hash (receipt in `docs/release/current-state-audit.md`). This observation is tied to that SHA and must be rechecked after every merge. The Vercel deployment ID, project identity and repeatable deployment route remain unverified because automatic Vercel Git deployment is disabled and the controlled workflow credential is unavailable. Release work must preserve exact-SHA verification and resolve this operational path before claiming reproducible releases.
