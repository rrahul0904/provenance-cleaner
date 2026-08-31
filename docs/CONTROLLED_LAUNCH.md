# Controlled Launch Verification

This wave does not add product features. It converts Phase 5 into an executable release gate.

## Current external state

- GitHub Actions: blocked by hosted-runner assignment. Issue #8 records the evidence and closure criteria.
- Vercel: no `provenance-cleaner` project is visible in the connected team yet.
- Supabase: only one generically named project is visible; no schema is applied until a dedicated project is explicitly selected/created.
- Stripe: test mode is connected. Three products/prices now exist; live mode was not touched.

## Stripe test catalog

| Pack | Credits | Test price | Product |
|---|---:|---|---|
| Starter | 10 | `price_1UAXO6RB8OGmEnBwqpc4DaLs` ($4.99) | `prod_VAtApHjbAUZCC6` |
| Plus | 25 | `price_1UAXOFRB8OGmEnBwlAwgU1GS` ($9.99) | `prod_VAtAXMWY43ZROc` |
| Pro | 100 | `price_1UAXOQRB8OGmEnBwANqar75f` ($24.99) | `prod_VAtA7y0J41uKl8` |

These IDs are test-mode configuration, not secrets. Browser code must still send only `starter|plus|pro`.

## Release gate

1. Generate and commit `package-lock.json` using Node 22.22+.
2. Restore GitHub hosted-runner assignment and require real `npm ci`, unit, lint, build, audit and Playwright steps.
3. Explicitly select or create a dedicated Supabase project, then apply Phase 4 followed by Phase 5 SQL.
4. Run `supabase/tests/phase_4_billing.sql`, security advisors and performance advisors.
5. Import this repository into a dedicated Vercel project.
6. Configure preview environment from `.env.controlled-launch.example`, supplying secrets through Vercel only.
7. Configure a Stripe test webhook targeting `/api/billing/webhook` and set its signing secret.
8. Configure Turnstile preview hostname/site/secret.
9. Run `npm run release:check` in the preview-configured environment.
10. Verify `/api/health` and `/api/readiness`.
11. Run browser smoke/E2E tests against the preview.
12. Confirm no runtime errors or content-bearing logs.
13. Only then consider merging the stacked Phase 0–5 PR chain toward `main`.

## Non-negotiable launch rules

- Stripe stays in test mode during this wave.
- Checkout redirect state never grants credits.
- Raw content never enters billing records or structured logs.
- No generic/unknown Supabase project is mutated by assumption.
- No production deployment is promoted from an unverified preview.
