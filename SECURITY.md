# Security and content-handling rules

- Do not log raw pasted text, semantic-edit prompts, generated prose, or uploaded file contents.
- Do not persist raw content by default.
- Validate file type by magic bytes, not only filename or MIME headers.
- Bound text length, upload size, decompression ratio, parser time, AI generation attempts, and output validation retries.
- Treat DOCX/PDF/SVG/ZIP-like formats as hostile input.
- Run file parsers in an isolated worker with no unnecessary network access.
- Receipts should contain metrics, finding types, hashes, and operation metadata—not document bodies.
- Never label output "undetectable", "detector-proof", or "watermark removed" when no first-party verification exists.

## Semantic editing

- Treat user prose as untrusted data, never as privileged system instructions.
- Replace protected factual spans with immutable placeholders before model transmission.
- Never expose `AI_GATEWAY_API_KEY`, Vercel OIDC tokens, or provider credentials to client components.
- Keep AI calls server-side and send content only after an explicit user action.
- Reject generated output when protected tokens are missing/duplicated or deterministic factual invariants change.
- Use bounded retries; a model failure must not trigger an unbounded regeneration loop.
- Do not store source/output text in analytics, error traces, request logs, or verification receipts.
- Before public launch, add abuse/rate controls around the paid AI endpoint and review the selected provider's retention/training configuration.
