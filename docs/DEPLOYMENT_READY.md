# Deployment readiness contract

Before a production deployment:

1. Apply and verify the Phase 7, Phase 8, and Phase 9 Supabase migrations. Phase 9 readiness must report schema version `20260915032600` with `atomicKeyCap: true`.
2. Verify the Stripe TEST recurring catalog. The three controlled-launch TEST price IDs are committed as a TEST-only fallback; environment overrides remain supported.
3. Verify the Stripe TEST production webhook includes one-time Checkout plus subscription lifecycle events.
4. Activate a Stripe TEST Billing Portal configuration.
5. Run CI and `deployment-readiness` against the exact release SHA.
6. Verify `/api/health` returns the exact deployed commit SHA and customer-facing `/api/readiness` reports `ready`, including the Phase 9 developer API schema.
7. Ensure the GitHub `production` environment contains `VERCEL_TOKEN` with deployment access to the configured Vercel team/project. The production workflow fails closed before build/deploy when this credential is absent.

Admin activation is intentionally independent from customer-facing service readiness. `/api/readiness` reports Admin state as a non-blocking signal; `/api/admin/readiness` remains fail-closed until either an enabled database owner exists in `ops.admin_users` or a valid one-time bootstrap identity is configured. This prevents an unverified or arbitrary user from becoming owner while allowing the public product to serve safely before a human operator completes account verification.

Automatic Vercel Git deployments remain disabled in `vercel.json`.

`deploy-production` supports two controlled entry points:

- manual workflow dispatch with an explicit `expected_sha`; or
- a push to the dedicated `production-release` branch.

For either path, the workflow checks out the supplied/event SHA, refuses any mismatch, requires the Vercel deployment credential, reruns certification, builds with `vercel build --prod`, and deploys that exact prebuilt artifact once. Normal pushes to `main` do not deploy production through this workflow.
