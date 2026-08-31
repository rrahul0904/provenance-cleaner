# Billing invariants

1. `billing.credit_ledger` is append-only and is the settled-credit source of truth.
2. A semantic edit follows `reserve -> generate -> validate -> commit`.
3. Provider or validation failure releases the hold; abandoned holds expire by TTL.
4. `billing.credit_accounts` is locked while reservations are evaluated, preventing concurrent tabs from double-spending availability.
5. Operation keys are unique per user; replay never creates a second hold.
6. A committed reservation has one unique ledger source key (`reservation:<id>`), so duplicate commits cannot debit twice.
7. Checkout success redirects never grant credits.
8. Only signature-verified Stripe webhook events may complete a purchase.
9. The browser chooses only `starter|plus|pro`; credit quantity and Stripe price are server-owned.
10. A Stripe session grants through one unique ledger source key (`stripe_session:<id>`).
11. Phase 5 accepts Stripe test-mode server keys only.
12. Completed Checkout sessions return duplicate semantics on later events; expired purchases cannot be completed by the billing RPC.
13. Billing records contain identifiers/amounts/status only, never raw source or generated prose.
