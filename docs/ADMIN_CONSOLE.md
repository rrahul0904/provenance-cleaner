# Admin Command Center

`/admin` and its Users, Growth, Usage, Billing, Subscriptions, FinOps, Operations, Audit, and System routes are server-authorized. A user is never promoted by signup order or client state.

`ADMIN_OWNER_USER_ID` is a required, deployment-time UUID. The server only bootstraps that exact existing Supabase Auth identity as owner. Additional admin rows are managed in the private `ops.admin_users` table. Roles are `owner`, `admin`, and read-only `viewer`.

The command center is no-store and derives metrics from Auth, billing, job history, subscription state, and privacy-safe operational events. It does not use browser analytics, replay, raw content, filenames, or file bytes.
