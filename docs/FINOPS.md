# FinOps

Costs use integer micros and money uses integer cents. Every provider cost event declares one source: `ACTUAL`, `ESTIMATED`, `MANUAL`, or `CONFIRMED_ZERO`.

The current provider inventory is Vercel, Supabase, Stripe, AI Gateway/model providers, Cloudflare Turnstile, GitHub Actions, and C2PA dependencies. A provider counts toward coverage only after its cost source is recorded. The Admin FinOps view deliberately shows zero coverage before cost rates or events exist rather than inventing an invoice.

Budgets are monthly micros with warning and critical thresholds. Forecasts use a clearly labelled run-rate calculation.
