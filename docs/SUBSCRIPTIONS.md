# Stripe TEST subscriptions

Monthly plans are Plus (30 credits / $9.99), Pro (120 / $24.99), and Studio (300 / $49.99), all in Stripe TEST mode. Pay-as-you-go packs remain available.

The authoritative grant flow is `invoice.paid` → verified Stripe event → subscription lookup → idempotent invoice record → the existing FIFO credit ledger and lot model. Payment failures grant nothing. Cancel-at-period-end retains existing earned credits and grants no subsequent period after cancellation. Billing Portal is used for customer subscription management.

Required server variables are `STRIPE_SUBSCRIPTION_PRICE_PLUS`, `STRIPE_SUBSCRIPTION_PRICE_PRO`, and `STRIPE_SUBSCRIPTION_PRICE_STUDIO`; none is exposed to the browser.
