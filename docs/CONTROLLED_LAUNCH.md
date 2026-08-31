# Controlled Launch

This branch keeps the production architecture intact while making the Vercel Preview self-configuring for non-secret launch inputs.

## Preview behavior

- Uses the dedicated Supabase project URL and publishable key when explicit `NEXT_PUBLIC_SUPABASE_*` variables are absent.
- Uses Cloudflare Turnstile official always-pass test credentials only when Vercel reports `preview`.
- Uses Vercel system URLs when `NEXT_PUBLIC_APP_URL` is absent.
- Uses Vercel OIDC for AI Gateway and as the server-only fallback salt for privacy-preserving request hashing.
- Uses the Stripe test Price IDs created for the controlled launch only when Vercel reports `preview`.
- Does not require the reconciliation cron secret in Preview.

## Secrets that remain external

The application still intentionally requires these true server credentials at runtime:

- `SUPABASE_SECRET_KEY`
- `STRIPE_SECRET_KEY` in test mode during controlled launch
- `STRIPE_WEBHOOK_SECRET`

These must never be committed to Git. The connected automation can provision Stripe test resources, but the current Vercel connector does not expose environment-variable writes, and Supabase does not expose its elevated secret key through the connected management tool.

## Stripe test webhook

A test-mode webhook endpoint is provisioned for the stable Preview branch URL and listens only for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`

The webhook signing secret is intentionally not written to this repository.

## Release gates

A controlled launch is not complete until:

1. the required Vercel server secrets are present;
2. `/api/readiness` reports `ready`;
3. guest auth and billing balance work against the dedicated Supabase project;
4. Checkout completes in Stripe test mode and webhook credit provisioning is verified;
5. `npm ci`, unit tests, lint, build, and E2E execute on a real CI runner or equivalent trusted environment;
6. production Turnstile credentials replace Preview test credentials before public production;
7. live Stripe mode remains untouched until an explicit production decision.
