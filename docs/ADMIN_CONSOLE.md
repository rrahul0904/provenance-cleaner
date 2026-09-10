# Admin Command Center

`/admin` and its Users, Growth, Usage, Billing, Subscriptions, FinOps, Operations, Audit, and System routes are server-authorized. A user is never promoted by signup order or client state.

Owner bootstrap supports two controlled paths:

- `ADMIN_OWNER_USER_ID`: authoritative UUID bootstrap for an existing Supabase Auth identity.
- `ADMIN_OWNER_EMAIL`: one-time bootstrap for the matching **verified, non-anonymous** Supabase user when no UUID is configured.

The email path never grants by an unverified address and is only a bootstrap mechanism. Once an enabled owner exists in the private `ops.admin_users` table, both bootstrap variables may be removed. Additional admin rows remain database-managed. Roles are `owner`, `admin`, and read-only `viewer`.

Customer-facing `/api/readiness` reports Admin activation as a non-blocking operational signal. The dedicated `/api/admin/readiness` endpoint is fail-closed and returns 503 until either an enabled owner has been provisioned or a valid bootstrap identity is configured. This keeps the public service deployable without weakening Admin authorization or automatically promoting the first registered user.

The command center is no-store and derives metrics from Auth, billing, privacy-safe job history, subscription state, TEST payment evidence and operational cost events. It does not use browser analytics, replay, raw content, filenames, or file bytes.

Financial metrics are explicitly TEST-mode evidence while Stripe remains in TEST mode.
