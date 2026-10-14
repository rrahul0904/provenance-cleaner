# Current-state forensic audit

**Audit date:** 2026-10-13 (America/New_York)
**Repository:** `rrahul0904/provenance-cleaner`
**Canonical production:** <https://provenance-cleaner.vercel.app>
**Scope:** repository source, GitHub metadata/workflows, locked dependency graph, automated tests, and read-only production endpoints. No production writes were made.

## Executive finding

At audit start, the checked-out tree at local commit `719948bd786aa9ca0ce9bda3d01f0e8d36d16ce8` was byte-for-byte equivalent to `origin/main` at `173074b71130fc08051ac86bee43dd6b0c33e2ef`. This implementation adds audit/architecture documentation, E2E portability fixes, and compatible lockfile security updates; those changes are not in production. Production health reports the exact main SHA, version `0.7.0`, release ID `pc-0.7.0-20261001`, and original production source hash `3e7bc99180c04a743b22fcf09e36868be59473aa55c4a081778d9503acd54e17`. Readiness is `ready`, with no missing required checks. This corrects older repository notes that described production as behind main.

This verifies the deployed application source identity and platform readiness. It does **not** verify the Vercel deployment ID, that the canonical alias points to the intended Vercel project, a successful real Stripe customer lifecycle, end-user signup/inbox verification, or every production browser workflow. The production branch `production-release` is behind main; its relationship to the currently deployed Vercel artifact is not established by repository evidence. Current Vercel Git deployments are disabled and the controlled deployment workflow has no `VERCEL_TOKEN` available in the inspected GitHub environments, so the mechanism that produced the currently verified deployment remains unverified.

## Repository and release inventory

| Item | Finding | Evidence / status |
| --- | --- | --- |
| GitHub default branch | `main`, SHA `173074b71130fc08051ac86bee43dd6b0c33e2ef` | Verified via GitHub API/CLI |
| Local checkout | `codex/release-integration`, SHA `719948bd786aa9ca0ce9bda3d01f0e8d36d16ce8` | Verified; tree equals `origin/main` |
| Pull requests | No open PRs; PR #43 is merged | Verified |
| Release tags | No Git tags/releases found | Verified |
| Production release branch | `production-release` at `9dbf3699937ba1c096f84c0309780db686bde400`, behind main | Verified; not a source of current deployed SHA |
| Main protection | PR required; `verify`, `e2e`, `certify` checks required; admins included; no force-push/deletion; conversation resolution required; zero approvals required | Verified from branch protection settings |
| Runtime | Node `24.x`; Next `16.3.8`; React `19.2.8`; Stripe `22.6.0`; Supabase JS `2.112.4`; app `0.7.0` | `package.json` / lockfile |
| Database schema | 11 ordered migrations; latest `20260915032600_phase9_developer_api_readiness_hardening.sql` | Verified in `supabase/migrations` and production readiness |
| Deployment config | `vercel.json` disables Git deployments; `deploy-production` is CLI-controlled and requires `VERCEL_TOKEN` | Source inspected; current credential not available to this audit |
| Actions security | Dependabot alerts/updates, secret scanning, and push protection are disabled; Dependabot alerts API is unavailable because the feature is disabled | Verified from repository security settings |

## Production receipt

Read-only HTTP checks on 2026-10-13 (local time):

| Endpoint / check | Result |
| --- | --- |
| `/api/health` | HTTP 200, `status: ok`, version `0.7.0`, phase 9, exact main SHA and source hash above, Node `24.21.0` |
| `/api/readiness` | HTTP 200, `status: ready`, `missing: []`; phase 6–9 schema/readiness checks pass; Admin owner/bootstrap are optional and unconfigured |
| `/`, `/pricing`, `/privacy-policy` | HTTP 200; security headers present |
| `scripts/verify-production.mjs --url https://provenance-cleaner.vercel.app --expected-sha 173074b71130fc08051ac86bee43dd6b0c33e2ef --attempts 1 --delay-ms 0` | PASS; reported exact expected SHA and source hash |
| GitHub scheduled production-integrity run `38479417560` | PASS on exact main SHA; health and readiness matched |
| Local Chromium browser suite | PASS, 40/40 Playwright E2E tests; isolated on port 3101 because another app occupied 3000 |
| Local release gate | PASS with the same non-secret CI placeholder environment used by workflows; without those test values, 19 environment-dependent checks correctly fail. Platform `/api/readiness` remains independently `ready` |
| Local `predeploy` configuration check | PASS with non-secret CI placeholder environment; this validates shape, not credentials or provider reachability |
| Vercel deployment ID / Ready record | NOT VERIFIED; not available from current GitHub/API access |
| Actual sign-up, paid checkout, entitlement, subscription management in production | NOT VERIFIED in this read-only audit |

## Dependency and supply-chain findings

The initial lockfile audit found **2 high production-tree advisories** (no production critical/moderate findings). The compatible security slice in this change updates the lockfile to the patched versions; a follow-up production-only audit now reports **0 advisories**:

| Package | Locked | Advisory | Fixed in | Exposure note |
| --- | --- | --- | --- | --- |
| `sharp` (transitive through Next) | `0.35.4` → `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | `0.35.5` | PATCHED in working tree; production remains on the old certified SHA until a release deploys this lockfile |
| `source-map-js` (transitive through Next/PostCSS) | `1.2.1` → `1.2.2` | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `1.2.2` | PATCHED in working tree; production remains on the old certified SHA until a release deploys this lockfile |

After the compatible lockfile fix, the full dependency graph reports 8 advisories: 1 moderate, 5 high, and 2 critical. The remaining findings are in the development/lint/test graph; npm's proposed Vitest fix is outside the declared version range, and its proposed `eslint-config-next` fix is a breaking downgrade. Repository tests use `vitest run`, not the Vitest UI server, but the findings still require separate triage and a deliberate dev-tool upgrade. No forced upgrade was applied.

## Architecture map

```text
Browser workbench ── local deterministic scan / supported file inspection / C2PA / receipt
       │
       ├── Next.js route handlers (`src/app/api/**`)
       │      ├── request validation, same-origin mutation checks, Turnstile and rate limits
       │      ├── text/file sanitation and protected semantic transform
       │      ├── account, API-key, history and admin operations
       │      └── billing checkout, portal, webhook and reconciliation
       │
       ├── domain modules (`src/lib/**`)
       │      ├── Unicode, C2PA, file formats, hashing and receipts
       │      ├── transform protection/validation and StyleBalanceMeter
       │      ├── billing/entitlement/credit operation logic
       │      └── Supabase, Stripe, AI Gateway, Turnstile and PulseAtlas adapters
       │
       ├── MV3 browser extension (`extension/**`)
       ├── zero-dependency Node CLI (`scripts/provenance-cli.mjs`)
       └── `/api/v1` developer API

Supabase Auth + Postgres/migrations ── identity, ledger, holds, usage, API-key hashes
Stripe TEST ── checkout and signed webhook lifecycle
Vercel AI Gateway ── only explicit semantic-edit requests
Vercel ── Next runtime, canonical production hostname, deployment configuration
```

The intended layering is partially present: domain and provider modules exist, but multiple API route handlers still orchestrate validation, billing, and provider work. Phase 1 documents the as-built boundary; a later architecture refactor should be driven by demonstrated duplication or failure modes rather than a wholesale rewrite.

## Capability maturity matrix

`Code` means source is present; `Unit` and `Integration` refer to repository tests; `E2E` means automated browser coverage exists (not necessarily production browser certification); `Production` means production evidence was observed during this audit. Statuses follow the program maturity model and avoid treating route existence as launch proof.

| Capability | Code | Unit | Integration | E2E | Production | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Unicode inspection and local sanitation | Present | Present | N/A/local | Core + offline specs | Not separately exercised end-to-end | PRODUCTIZED |
| Image/DOCX/PDF metadata and provenance inspection | Present; PDF inspection-only | Present | Route/file tests | Core flow coverage | Not exercised with production upload | IMPLEMENTED_UNVERIFIED |
| PNG/JPEG/DOCX sanitation | Present; signed C2PA blocks destructive clean | Present | Billing/job route tests | Core flow coverage | Not exercised with production upload | IMPLEMENTED_UNVERIFIED |
| Text sanitation and receipts | Present | Present | Route/billing tests | Core spec | API/readiness only | IMPLEMENTED_UNVERIFIED |
| Protected semantic transform | Present; explicit model call, invariant checks and bounded retries | Present | Route and billing tests | Core/economics specs | No real production model journey tested | IMPLEMENTED_UNVERIFIED |
| StyleBalanceMeter | Present; independent explainable metrics | Present | N/A | Limited integrated surface coverage | Not separately exercised | PRODUCTIZED |
| Receipt/hash verification | Present | Present | Artifact tests | Core flow coverage | Production build hash observed; user receipt flow not tested | IMPLEMENTED_UNVERIFIED |
| Guest and registered authentication | Present; Supabase Auth | Present | Route/security tests | Auth/privacy coverage | Readiness proves config only; inbox/login not exercised | IMPLEMENTED_UNVERIFIED |
| Credits, reservations, idempotency and refunds | Present; append-only ledger / migrations | Present | Stripe and DB RPC simulations | Economics/admin specs | Readiness proves schema; real transaction not tested | IMPLEMENTED_UNVERIFIED |
| Stripe one-time TEST checkout/webhook | Present; TEST mode enforced | Present | Signed webhook/reconciliation tests | No production-safe purchase completed | Catalog/config readiness only | IMPLEMENTED_UNVERIFIED |
| Subscriptions and portal | Present | Present | Subscription tests | Limited contract coverage | No production lifecycle tested | IMPLEMENTED_UNVERIFIED |
| Developer API and key lifecycle | Present; v1 routes | Present | Route/schema tests | No full external-client journey | Schema readiness only | IMPLEMENTED_UNVERIFIED |
| Browser extension | Present; MV3 | Present indirectly | Not independently packaged here | Not certified in Chrome in this audit | Not applicable | IMPLEMENTED_UNVERIFIED |
| CLI | Present; Node CLI | CLI behavior not exhaustively certified here | N/A | N/A | Not applicable | IMPLEMENTED_UNVERIFIED |
| Admin/FinOps | Present; authorization is designed fail-closed | Present | Contract tests | Admin contract spec | Admin owner is deliberately not provisioned | IMPLEMENTED_UNVERIFIED |
| Health/readiness/source integrity | Present | Present | Production verifier | N/A | Exact main SHA/source hash and ready status verified | PRODUCTION VERIFIED |
| Privacy/data deletion | Present; policy and deletion flows | Present | Phase 6/8 tests | Privacy UI specs | Provider retention and live deletion not independently verified | IMPLEMENTED_UNVERIFIED |
| Mobile/accessibility | Present; responsive UI claims and tests | N/A | N/A | Privacy/UI coverage | Not manually assessed across target devices | IMPLEMENTED_UNVERIFIED |

Historical parity documents contain 35 rows and claim 29 verified, 5 intentional divergences, and 1 publicly unverifiable behavior. Those are useful historical research, not proof of current production behavior; they have not been re-counted as a fresh production certification in this audit.

## Monetization readiness

| Gate | Finding | State |
| --- | --- | --- |
| Product pricing and limits | Shared contract defines 1 credit/1,000 words (minimum 1), file actions 1 credit, 8,000-word rewrite cap, 3.2 MiB file cap; packs are TEST-only | SOURCE VERIFIED |
| Stripe credentials/catalog | `/api/readiness` reports required config/catalog checks ready; Stripe mode is TEST | CONFIG VERIFIED, real test purchase not exercised |
| Checkout and webhook implementation | Server-owned plan selection, signature-checked webhook, duplicate-event and ledger source-key protections have tests | IMPLEMENTED / TEST VERIFIED |
| Subscription checkout and management | Routes and billing portal exist; tests cover contract/reconciliation pieces | IMPLEMENTED_UNVERIFIED end-to-end |
| Refund lifecycle | FIFO purchased-lot/refund logic exists with tests | IMPLEMENTED_UNVERIFIED in production |
| Customer production lifecycle | No safe complete checkout-to-entitlement-to-use-to-portal receipt from this audit | NOT VERIFIED |
| Commercial state | No real launch/conversion/repeat-use evidence reviewed | NOT LAUNCHED / NOT VALIDATED |

## Security, UX, and operational blockers

### Security blockers

1. **Production dependency release gate:** the working-tree lockfile now patches the two high advisories, and production-only audit is clear. This fix is not deployed; do not release the old certified SHA or claim production remediation until the new exact SHA is deployed. [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w); [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
2. **Security automation disabled:** Dependabot alerts/updates, secret scanning and push protection are off. Enablement is a repository-security settings change and should be handled as a dedicated security task.
3. **Supabase leaked-password protection:** current setting was not accessible in the read-only audit; mark NOT VERIFIED until the Auth setting is inspected.
4. **Admin owner:** intentionally not provisioned; acceptable for customer readiness, but operational admin use remains blocked until a verified operator is provisioned via documented procedure.
5. **Deployment provenance:** exact source is verified, but Vercel deployment ID/project/route origin is not. Deployment workflow credential is absent and Git deployments are disabled; resolve this before claiming a reproducible release path.

### UX and reliability blockers

1. No production browser certification of anonymous scan, file flow, transform, sign-up, checkout, account deletion, offline boundary, or responsive accessibility.
2. No complete Stripe TEST customer journey receipt from pricing through payment, webhook entitlement, paid action, and portal/refund.
3. Operational recovery procedures exist in fragments, but this audit did not exercise Supabase/model/Stripe outage, webhook delay/replay, or migration mismatch.
4. Analytics is disabled, so funnel and repeat-use metrics required for launch validation are not yet available.

### Audit-search findings

- No `AGENTS.md` found.
- No checked-in `.skip` or `test.only` discovered in the test inventory.
- TODO/FIXME search found no active product implementation marker; remaining matches were test fixtures, examples, or HTML input placeholders.
- No hard-coded production credential identified in the inspected source. Committed Stripe price IDs are explicitly TEST-only fallbacks.
- Existing docs overlap on architecture, parity, deployment, and phase completion. Older “production mismatch” claims must be treated as stale after this audit; preserve historical docs but link them to this receipt.
- No known duplicate product implementation was established. There is route-level orchestration duplication that should be assessed with tests before consolidation.
- The initial browser-test launch was blocked by the host's missing `npm` executable and an unrelated process on port 3000. After restoring ignored `node_modules` from the committed lockfile, the complete 40-test Chromium suite passed on port 3101. Playwright now accepts `PLAYWRIGHT_PORT` so local verification can use an isolated port. This local browser run does not certify production journeys.

## Immediate phased backlog

| Order | Slice | Exit evidence |
| --- | --- | --- |
| 1 | Freeze product journeys, contract, system/data/security/offline/billing boundaries (Phase 1) | Documents agree with current code and label external/provider behavior accurately |
| 2 | Certify core deterministic inspection, receipts, and sanitation (Phases 2–3) | Golden fixtures, adversarial format cases, browser/runtime receipts |
| 3 | Certify safe transform and protected facts (Phase 4) | Failure/retry, invariant, UX compare/undo and receipt evidence |
| 4 | Close auth/abuse gaps and verify production Auth settings (Phase 5) | User journey and configuration receipts; leaked-password setting known |
| 5 | Certify ledger, Stripe TEST and subscription lifecycle (Phases 6–7) | Checkout→webhook→entitlement→usage→portal/refund with idempotency/reconciliation |
| 6 | Resolve production dependency findings; assess dev graph separately (Phase 12) | Production audit clean or documented accepted-risk rationale, CI/build pass |
| 7 | Activate/verify observability and operator access/recovery (Phases 13–14) | Failure drills, privacy-safe operator runbook, verified admin ownership |
| 8 | Complete responsive/accessibility/browser certification and production release (Phases 15–18) | Exact SHA/deployment receipt plus production journeys, launch/support/metrics gates |
| 9 | Collect commercial evidence before `LAUNCHED`/`VALIDATED` (Phase 19) | Real usage, conversion, repeat use, costs and support evidence |

Phase 0 exit: repository and production source identity are known; the remaining unverified customer journeys, dependency risk, configuration gaps, and release-path ambiguity are explicit. Phase 1 is documented in the accompanying architecture/product files. No customer-facing behavior was changed as part of this audit.
