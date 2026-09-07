# Phase 7 architecture

The additive Phase 7 migration creates private `ops` tables for RBAC, audit, metrics, costs, budgets, rollups, and system snapshots, plus Stripe customer, subscription, and period-grant records in `billing`.

Browser roles have no table or function permissions. Service-role RPCs are narrowly scoped, use controlled search paths, and preserve the existing Phase 6 FIFO ledger rather than creating a parallel subscription balance.

Daily rollups use UTC boundaries via `/api/internal/ops-rollup`, authenticated with `CRON_SECRET`. The admin console mixes historical rollups with current server aggregates where available.
