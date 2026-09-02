# Codex Continuation Prompt — Provenance Cleaner Final Parity Completion

Continue implementation in:

- Repository: `rrahul0904/provenance-cleaner`
- Base branch: `main`
- Audited base SHA: `e5c5aa20693d081e400c16eb690d43ceef92d7a9`
- Working branch: `final-parity-audit-completion`
- Existing PR: #13 — `Final parity audit and completion`
- Current implementation head at handoff: `590329c83c4b9808f1a7203aead462bcb52751a2` or newer if PR #13 has advanced
- Supabase project: `cikxzxxreryycfjumwsd`
- Vercel project: `prj_OfVZG87ItRr7Kzw6PJT9Z5ouw04K`
- Vercel team: `team_zmEezpOKGZy2sH5nqTfO44LD`
- Reference product: `https://un-claude.com`
- Stripe: **TEST MODE ONLY**. Never create a live charge in this wave.

## Mission

Finish the clean-room reverse engineering and implementation with evidence. Do not trust the old parity matrix, do not trust a committed migration as proof of deployed schema, and do not trust a READY deployment as proof of product parity.

Completion requires zero unexplained public-feature gaps, zero release-critical UNKNOWN/PARTIAL/TODO states, green CI, green exact-head Preview, deployed and security-reviewed database schema, and verified launch-critical runtime flows.

Keep moving when one external gate is blocked. Work every independent stream that can be completed safely. Never weaken a gate merely to make CI green.

## Preserve the work already in PR #13

Do not revert these repairs unless a test proves they are wrong:

- internal Next.js navigation/lint repairs;
- anonymous Supabase claim typed as boolean;
- current Stripe Checkout shipping country path via `collected_information.shipping_details`;
- ordinary sign-in no longer directly claims the signup promo;
- signup/upgrade callback intent marker for the one-time +3 promo;
- `PROMO_FINGERPRINT_SECRET` in env example, readiness, release gate, length validation;
- bounded warm-process rate limiter;
- DOCX ZIP preflight bounds and malicious compression fixture;
- C2PA invalid/tamper precedence over untrusted signer;
- C2PA/file selection race protection;
- whitespace-trimmed transform input validation;
- stale transform result cancellation/invalidation;
- server-authoritative ephemeral DOCX/PNG/JPEG sanitation with one-credit reserve → sanitize → verify → commit/release;
- global public product navigation and removal of internal phase copy.

## First gate — establish the exact current branch state

1. Fetch/prune and check out `final-parity-audit-completion`.
2. Pull fast-forward only.
3. Record `git rev-parse HEAD` and PR #13 head.
4. Inspect the latest GitHub Actions run for that exact SHA.
5. Run locally:
   - `npm ci`
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `npm audit --omit=dev`
   - `npm run release:check` with safe TEST placeholders only where the gate is intentionally static.
6. Fix real failures. Do not delete tests or lower assertions to pass.

## Mandatory re-reverse-engineering

Use a real browser against the current public reference. Stay clean-room: public pages, normal browser-visible behavior, legitimate test accounts, low-volume controlled fixtures only. Never copy source, bundles, CSS, branding, assets, protected copy, private APIs, credentials, or access-controlled implementation details.

Create `docs/REFERENCE_BEHAVIOR_SPEC.md`. Every public behavior must have:

`ID | route | user state | input | action | observable output | persistent state change | economic effect | privacy effect | error behavior | mobile behavior | our implementation path | test ID | evidence | parity state`

Inventory at minimum public home/how-it-works/capabilities/mission/pricing/contact/auth/legal/error routes plus guest, authenticated, account, history, checkout success/cancel, insufficient credits, validation errors, account deletion, and mobile-menu states.

Final states are only `VERIFIED`, `INTENTIONAL_DIVERGENCE`, or `UNVERIFIABLE_PUBLICLY` for launch-critical items.

## Exact Unicode audit

Create `docs/UNICODE_REFERENCE_AUDIT.md` using low-volume controlled strings. Determine the exact publicly observable nine scanner classes; do not infer them from our implementation. Record reference label, candidate code points/ranges, positions, removal behavior, post-clean result, language/emoji risk, our behavior, and evidence.

If reference deletion would corrupt legitimate Arabic/Persian/Indic/BiDi/emoji semantics, preserve the stronger safety behavior and mark `INTENTIONAL_DIVERGENCE — language integrity` while still detecting/reporting the character.

## Product orchestration

Introduce one domain-level `SanitizationJob` (or equivalent) with explicit stages such as `inspect → plan → reserve → sanitize → rewrite-if-applicable → validate → commit → receipt`.

The user chooses input, not an internal engine:

- pasted text: free scan, conservative hidden-character clean, parity semantic edit where contract requires it;
- TXT: same logical text route;
- DOCX: hidden-character/Office metadata sanitation, no automatic semantic rewrite;
- PNG/JPEG: metadata privacy sanitation, no semantic rewrite;
- signed C2PA/Content Credentials: explain integrity impact and never silently mutate hard-bound bytes.

Keep free scanning account-free and non-billable. Every charged job must have server-authoritative economic state.

## Rewrite parity contract

Keep existing extra modes, but add a clearly named `parity`/`sanitize` mode backed by tests. Reconfirm the live reference before hard-coding exact thresholds; if the observed contract remains the same, enforce:

- approximately `0.90 <= output_words / source_words <= 1.10`;
- no more than three consecutive source words outside protected spans;
- exact protection for quotations, citations, references, URLs, emails, dates, signed numerics, percentages, currencies, decimal/grouped values, and reliably detectable named entities/proper names;
- no corruption to protected material just to hit overlap targets;
- transparent retry/failure if invariants cannot be satisfied.

Fix signed-number handling so `-5`, `+5`, `50%`, `$20`, `€20`, `£20`, and `1,234.50` cannot lose their sign/unit semantics.

Use bounded deterministic/local named-entity extraction where adequate; do not add an unbounded extra LLM call just to test invariants.

Expand the rewrite receipt with source words, output words, retained %, wording replaced %, longest unprotected shared run, numeric/date/entity checks, quote/reference preservation, protected span count, credits, model, and attempts.

Add:

```ts
interface TextWatermarkVerifier {
  verify(text: string): Promise<VerificationResult>;
}
```

Until a legitimate public verifier exists, return `available=false`, `status=unavailable`. Never claim statistical watermark removal is verified.

## Database — redesign before applying Phase 6

The live Supabase project currently has Phase 4 credit/ledger/reservation/purchase primitives, but the queried Phase 6 promo/refund/history objects are absent.

**Do not apply the current Phase 6 SQL as-is.** First solve these design defects:

1. FIFO credit-lot allocation for purchased-credit refundability across promos, purchase A, purchase B, usage, releases, and earlier refunds. Do not use a global-balance shortcut.
2. Controlled account deletion/anonymization. Existing auth-user cascades and append-only ledger delete protection conflict. Preserve append-only accounting during normal operation while allowing a privileged, explicit deletion/anonymization path.
3. Keep the keyed signup-promo email fingerprint independent so delete/recreate cannot re-claim +3; never retain the raw email solely for promo abuse prevention.
4. Retain only the minimal payment reconciliation data independently required after identity deletion.
5. All SECURITY DEFINER functions: fixed/controlled `search_path`, service-role-only execute, no public/anon/auth execution, no trust in client-supplied foreign user IDs, concurrency safe, idempotent.
6. File job history: kind, credits, timestamp, status, size bucket; never filename, bytes, path, raw extracted text, or transformed content.
7. Add real migration history, then apply to `cikxzxxreryycfjumwsd` and verify objects/privileges directly with SQL.
8. Run Supabase security and performance advisors. Resolve every security error before release.

Add readiness `phase6Schema` based on a safe authoritative query, not an env flag.

## Guest/account/promo semantics

Prove with concurrent tests and Preview runtime evidence:

- free scan creates no account and no credit activity;
- first signed-out clean creates/reuses one anonymous identity, grants +2 exactly once, then charges the real job cost; if cost is 1, remaining balance is 1;
- guest identity persists according to the documented browser-session contract without fingerprint recovery after storage is cleared;
- guest→Google and guest→email/password preserve credits/history exactly once;
- signup +3 is granted once for genuine account creation/upgrade, never ordinary sign-in;
- delete/recreate same normalized email receives no second +3;
- simultaneous requests cannot create +4/+6 promo races.

## Stripe TEST reliability

Remain TEST only. Prove:

- pack prices/credits and US-only Checkout policy;
- signed webhook and exact once +credits;
- webhook replay changes nothing;
- checkout success polls authoritative state for a bounded interval instead of requiring reload;
- missing/non-US country is rejected safely;
- if a prohibited paid Checkout ever completes, automatically reconcile/refund it instead of leaving paid-but-uncredited state;
- 30-day unused purchased-credit refund uses correct FIFO quote;
- current Stripe refund idempotency remains; add reconciliation for `Stripe succeeded → DB write failed → retry/network timeout` without double refund/debit.

Use only dedicated TEST users/purchases.

## Privacy and observability

Enforce the content boundary:

- scan local;
- supported inspection local;
- billable file sanitation may be ephemeral server-memory processing, with no intentional persistence;
- semantic rewrite only after user action through Vercel AI Gateway;
- raw source/result/file bytes/filename must not be written to Supabase, Stripe metadata, PostHog, billing metadata, or operational logs.

Replace exact content-derived log counts such as raw `sourceChars`/`sourceWords` with buckets unless exact precision has a documented operational requirement.

After Preview and Production fixtures, search logs, Supabase, Stripe metadata, analytics, and browser storage for unique markers.

## Analytics decision

Either:

A. implement PostHog in true cookieless/memoryless mode, with no raw content/filename/localStorage identity and **zero analytics events when `navigator.doNotTrack` is enabled**; or

B. explicitly mark PostHog as `INTENTIONAL_DIVERGENCE`, keep analytics disabled, and remove any privacy copy claiming it is active.

Do not leave policy and runtime inconsistent.

## Public UX, accessibility, mobile

Verify the global header/footer exposes How it works, Capabilities, Mission, Pricing, FAQ, Contact, Privacy, Terms, Cookies, Account/Sign in. Do not use reference branding/trade dress or fake press endorsements.

Remove all internal phase/roadmap language from public UI.

Run responsive checks at 375, 390, 768, 1024, 1440 across home/scanner/file/rewrite/pricing/auth/account/history/contact/legal. No horizontal overflow.

At minimum test keyboard navigation, focus visibility, labels, associated errors, heading hierarchy, ARIA live status for async operations, dialog semantics where used, and contrast.

Contact must remain mailto-only; add an E2E network assertion that typed contact content is never POSTed to an app endpoint.

## Boundary and race tests

Add explicit regression/E2E tests for:

- file size just below / exact / just above 3.2 MB on client and server;
- rewrite 7,999 / 8,000 / 8,001 words, with 8,001 rejected before model/billing;
- whitespace-only input rejected before model/billing;
- signed numerics and percentages;
- stale transform source and in-flight supersession;
- DOCX decompression abuse;
- C2PA invalid+untrusted precedence;
- C2PA file A→B async race;
- promo concurrency;
- reservation commit/release;
- account deletion after promo, purchase, usage, release, completed reservation, and refund;
- session ineffectiveness after deletion;
- DNT analytics behavior;
- browser storage contains no raw document content.

## Preview and Production gates

Preview must be `READY` for the exact PR head SHA and `/api/readiness` must be 200 with `missing=[]`. Configure `PROMO_FINGERPRINT_SECRET` as a real server-only secret of at least 32 random bytes/characters in Preview and Production; never print it.

Run launch-critical Preview flows against real TEST integrations, not mocks.

Only merge PR #13 when:

- CI green including E2E;
- exact-head Preview green;
- redesigned Phase 6 migration applied and verified;
- Supabase advisors green;
- Preview text/file/auth/promo/history/delete flows green;
- Stripe TEST purchase/replay/refund/reconciliation green;
- privacy audit green;
- parity matrix has no launch-critical UNKNOWN/PARTIAL/TODO/GAP.

After merge, require final `main` CI on the exact merge SHA, exact-SHA Vercel Production READY, health/readiness 200, then run the dedicated Production TEST-mode smoke and privacy search. Delete the repair branch only when it is fully merged/ahead_by=0.

## Deliverables

Create/update:

- `docs/REFERENCE_BEHAVIOR_SPEC.md`
- `docs/UNICODE_REFERENCE_AUDIT.md`
- `docs/FINAL_REFERENCE_PARITY.md`
- migration files/history for final Phase 6 schema
- regression and E2E tests
- deployment/readiness documentation

Final report must include exact denominators:

- total public behaviors inventoried;
- verified;
- intentional divergences;
- unverifiable publicly;
- remaining blockers;
- final main SHA;
- CI status;
- Vercel deployment ID/SHA/target/state/health/readiness;
- Supabase Phase 4/5/6/RLS/privileges/advisors;
- Stripe mode/purchase/webhook/replay/refund/live-charge-created=NO;
- explicit YES/NO privacy invariants.

Do not report a vague parity percentage without a denominator.

## Required final line

Use exactly one:

`LIVE — full clean-room observable parity and production verification passed`

or

`NOT LIVE — blocked by: <exact remaining blockers>`

Never declare full parity while any launch-critical behavior remains unverified.
