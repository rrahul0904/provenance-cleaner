# PulseAtlas instrumentation

PulseAtlas is an optional observability sink, never the authority for Provenance Cleaner documents, receipts, credits, accounts, or billing.

Current telemetry is intentionally narrow:

- successful text inspection/sanitization emits `inspection_completed` with only `file_type`, `operation`, and `result`;
- health checks may emit a component/status fact.

The integration never sends document text, extracted text, edited output, C2PA manifests, hashes/receipts, credentials, auth tokens, or payment data. Delivery is short-timeout and fail-open so a PulseAtlas outage cannot block inspection or cleaning.

Configuration is server-only:

- `PULSEATLAS_ENDPOINT`
- `PULSEATLAS_WRITE_KEY`
- `PULSEATLAS_ENVIRONMENT`
