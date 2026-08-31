# Security and content-handling rules

- Do not log or persist raw pasted text, prompts, rewritten output, or uploaded file contents by default.
- Never expose `SUPABASE_SECRET_KEY`, Stripe secret keys/webhook secrets, or AI credentials to browser code.
- Authorize a verified user session before every elevated Supabase billing call.
- Credit ledger rows are append-only; database updates/deletes are rejected.
- Credit reservations are atomic and idempotent.
- Never trust credit quantities, Stripe Price IDs, or user IDs supplied by the browser.
- Checkout success redirects do not grant credits; only signature-verified webhooks do.
- Verify Stripe against the unmodified raw request body and deduplicate events/grants.
- Keep anonymous welcome credits at zero until bot protection exists.
- Enforce request/minute and 24-hour AI-cost limits server-side.
- Validate file types by magic bytes and bound parser/model resource use.
- Receipts contain metrics, hashes, billing IDs, and operation metadata—not document bodies.
- Do not cache auth refresh responses across users.
- Never use user-editable Supabase `user_metadata` for authorization.
- Never label output “undetectable”, “detector-proof”, or “watermark removed” without first-party verification.
