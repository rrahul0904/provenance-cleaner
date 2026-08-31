# Billing database tests

`phase_4_billing.sql` is intentionally executable only against a dedicated test/dev Supabase database and requires an existing auth user UUID via `TEST_USER_ID`. It runs inside a transaction and rolls back.

It covers bootstrap/grant idempotency, append-only ledger enforcement, reservation commit/release/expiry, duplicate commits, Checkout completion deduplication, and privileged-function access checks.

Concurrency requires two database sessions: start two `billing_reserve_credits` calls for the same funded user at the same time with different operation keys and a balance that can fund only one. Because `billing_reserve_credits` locks `billing.credit_accounts` `FOR UPDATE`, exactly one reservation can consume the remaining availability; the other must observe the updated held balance and fail with `insufficient_credits`. Automate this with the project CI database once a dedicated Supabase project/local stack is available.
