# Phase 4 — Accounts, credits, checkout, and cost controls

## Implemented
- Supabase SSR sessions for Next.js 16 using `proxy.ts`.
- Anonymous guest sessions plus optional Google identity linking.
- Modern publishable/secret key conventions; server secret never enters browser code.
- Append-only credit ledger.
- Reservation lifecycle: `reserved → committed / released / expired`.
- Atomic reserve checks under an account row lock.
- One credit per 1,000 source words, rounded up.
- Per-user requests/minute and 24-hour model-credit safety limits.
- Semantic editor reserves before AI generation and commits only after validation succeeds.
- Generation/validation failures release the hold; expiry is the final interrupted-request recovery path.
- Stripe-hosted one-time Checkout for fixed server-side pack IDs.
- Signed raw-body webhook verification and idempotent purchase grants.
- Browser-visible account controls and billing receipt.
- No raw document text in billing tables.

## Database application status
The connected Supabase account currently exposes one generic project that is not identified as belonging to this repository. No live schema was mutated by assumption.

`supabase/schema/phase_4_accounts_credits.sql` is a **staged canonical schema**, not a migration-history file. Once a Supabase project is explicitly linked to this app: apply/iterate the SQL, run security/performance advisors, fix findings, then generate the committed migration using the current Supabase migration workflow.

## Stripe setup required
Create three one-time Prices and set `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PLUS`, and `STRIPE_PRICE_PRO`. Configure `/api/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`. Credits are granted only from a verified webhook; the Checkout success redirect never grants credits.

## Abuse note
`WELCOME_CREDITS` defaults to `0`. Do not enable meaningful free anonymous credits until bot protection is deployed; clearing browser storage can otherwise create another anonymous identity.
