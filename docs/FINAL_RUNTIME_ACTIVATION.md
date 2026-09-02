# Provenance Cleaner — Final Runtime Activation Evidence

This document records runtime activation evidence for PR #13 (`final-parity-audit-completion`). It intentionally distinguishes source/CI evidence from protected Preview runtime evidence. Stripe remains TEST MODE ONLY. No live charge is permitted in this launch wave.

## Evidence checkpoint — 2026-09-02

### Repository

- Base: `main` at `e5c5aa20693d081e400c16eb690d43ceef92d7a9`.
- PR: `#13 — Final parity audit and completion`.
- Evidence commit: `a3e75bb9a3c04939e05910be6deae983964aa3bd`.
- PR remains open and unmerged.

### Exact-head CI

GitHub Actions run `33587183924` executed against the `a3e75bb9...` PR head.

- unit tests: PASS
- lint: PASS
- production build: PASS
- production dependency audit: PASS
- release gate: PASS
- normal Playwright browser E2E: PASS

This establishes code/test health only. It does not establish protected Preview auth, economic, webhook, or production parity.

### Exact-head Vercel Preview

Vercel deployment `dpl_6NaoVnF8674Vou5Z36khVCvfL44P` was created from `a3e75bb9a3c04939e05910be6deae983964aa3bd` on `final-parity-audit-completion` and reached `READY`.

`/api/health` now includes the deployment Git commit SHA so future runtime verification can reject a stale branch alias instead of accidentally certifying an older Preview.

### Anonymous Supabase evidence

A real protected-Preview request at approximately `2026-09-02T03:03:32Z` successfully called `POST /api/auth/anonymous` and emitted `guest_session_created`.

Production Supabase inspection found exactly one anonymous Auth user created in that test window and exactly one matching `billing.credit_accounts` record. Therefore anonymous sign-in itself and initial billing-account creation are proven to have reached Supabase.

The Vercel runtime log shows the observed `/api/billing/balance` request at `03:03:31Z`, before the successful anonymous POST. There is no app-level balance request after that POST in the inspected logs. Therefore the prior report of `guest created → subsequent balance 401` is not sufficient evidence of a Supabase cookie/session defect and must not be used to justify an unproven auth rewrite.

### Protected Preview blocker

The dedicated guest-session runtime workflow run `33587183910` failed before reaching Provenance Cleaner because Vercel Deployment Protection intercepted the browser.

The workflow environment showed `VERCEL_AUTOMATION_BYPASS_SECRET` was not configured. This is expected after the prior temporary bypass was revoked, but it means automated protected-Preview browser verification cannot currently run from GitHub Actions.

The current test harness now reports this as an explicit infrastructure blocker rather than allowing it to masquerade as an application auth failure.

### Guest-session runtime contract pending protected access

Once authorized Preview automation access exists, the dedicated smoke must prove all of the following against the exact PR head before Stripe runtime testing starts:

1. signed-out balance endpoint returns `401`;
2. anonymous POST returns `200` and an anonymous Supabase user;
3. Supabase auth cookie is stored with secure root-path attributes;
4. immediate balance request returns `200`;
5. browser reload retains the guest session and balance;
6. navigation to another route retains the same authenticated guest state.

Only after this passes may the launch wave proceed to first-clean `+2` promo/debit economics and real Stripe TEST Checkout/webhook verification.

## Current launch conclusion

`NOT LIVE — blocked by: protected Preview automation access for exact-head guest-session runtime proof; subsequent guest first-clean economics; Stripe TEST Checkout/webhook/replay/refund runtime verification; remaining auth-upgrade/deletion/privacy/mobile/accessibility gates; and final exact-main Production TEST-mode verification.`
