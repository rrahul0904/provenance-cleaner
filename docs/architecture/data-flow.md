# Data flow and retention boundaries

| Flow | Content path | Persistence / logging contract | Verification status |
| --- | --- | --- | --- |
| Local text scan | Browser deterministic Unicode engine | No application request required; receipt uses hashes/metrics | Source and unit tests present; production browser journey unverified |
| Local file inspection | Browser file/parser/C2PA engines for supported formats | No raw upload to server for inspection | Source/tests present; production upload journey unverified |
| Text/file sanitation | Browser → Next route → reserve → sanitize/verify → commit or release → response | Raw content processed transiently; billing/history retains operation metadata only; logs redact content | Route and unit/integration tests; production journey unverified |
| Semantic transform | Explicit action → transform route → protect spans → AI Gateway/model → validate/restore facts → commit/release → receipt | Source/output prose is not intentionally stored in application history/logs; provider operational handling is subject to provider terms | Unit/route tests; production model flow unverified |
| Authentication | Browser → Supabase Auth/session → server authorization | Identity/session state is persisted by Supabase | Config/readiness verified; live signup/inbox flow unverified |
| Checkout | Browser chooses plan key → app creates server-owned Stripe TEST session → signed webhook → database purchase/ledger | Stripe payment/session identifiers and amounts; no prose | Contract and replay tests; full hosted TEST purchase unverified |
| Account history/deletion | Authenticated browser → account routes → Supabase records/reconciliation | Operational metadata; deletion may retain required accounting/anti-abuse records | Tests exist; live deletion and third-party retention unverified |
| Telemetry | Server events → PulseAtlas adapter | Request/operation IDs, hashed subjects, bounded buckets, status and latency; avoid raw content | Instrumentation exists; production event delivery/alerting not independently proven |

The application cannot promise zero processing by hosting, auth, payment, or model providers. User-facing privacy statements must distinguish application persistence from provider infrastructure processing.
