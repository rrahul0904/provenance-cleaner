# Deployment readiness contract

Before a production deployment, apply and verify the Phase 7 migration, configure a real `ADMIN_OWNER_USER_ID`, configure all three Stripe TEST recurring price IDs, extend the existing Stripe TEST webhook event list, and run `npm run predeploy:certify` with the production configuration contract.

`deploy-production` is intentionally workflow-dispatch only. It checks out the supplied SHA, refuses any mismatch, runs certification, runs `vercel build --prod`, and deploys that exact prebuilt artifact once.
