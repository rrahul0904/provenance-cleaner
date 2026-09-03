# Phase 7 deployment budget

Automatic Vercel Git deployments are disabled in both project settings and `vercel.json`.

Development verification is local and GitHub CI only. Do not create Preview, debug, or UI-review deployments. The only permitted release path is the manual `deploy-production` workflow, which requires an exact expected SHA, builds a prebuilt production artifact, and deploys it once.

Never use a deployment to diagnose TypeScript, migration, UX, or test failures.
