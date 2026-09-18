# Developer API

Phase 9 adds server-to-server automation without weakening the existing privacy, billing, or provenance contracts.

## Authentication

Developer access uses Bearer keys created from the verified Account page. Keys begin with `pc_sk_`.

- raw secrets are returned exactly once at creation time;
- only a SHA-256 digest and short display prefix are stored;
- anonymous or unverified accounts cannot create keys;
- up to 10 active keys are allowed per account;
- revocation is immediate;
- deleting the Supabase user cascades developer keys;
- never expose a key in browser code, public repositories, client-side environment variables, analytics, or logs.

```http
Authorization: Bearer pc_sk_...
```

## `POST /api/v1/scan`

Free deterministic Unicode inspection and optional sanitation. This route does not spend credits.

```json
{
  "text": "Text to inspect",
  "sanitize": "none"
}
```

`sanitize` is one of `none`, `conservative`, or `aggressive`.

The response contains the same deterministic scan receipt and optional sanitation evidence used by the product UI. The route is rate limited per API key and does not persist submitted text.

## `GET /api/v1/usage`

Returns the authoritative credit balance for the account attached to the API key.

```json
{
  "balance": {
    "settled": 25,
    "held": 0,
    "available": 25
  },
  "key": {
    "prefix": "pc_sk_..."
  }
}
```

## `POST /api/v1/transform`

Runs the same protected-span semantic transformation contract as the browser workbench, using the API-key owner's authoritative credit account.

```json
{
  "operationId": "8e1d8274-f4e9-44bf-98fb-2aa2b8bd2c4a",
  "text": "Text long enough to satisfy the transform contract.",
  "mode": "natural",
  "purpose": "work",
  "intensity": "balanced"
}
```

`mode` is one of `parity`, `natural`, `clarity`, `concise`, or `formal`. `purpose` is one of `general`, `email`, `work`, `academic`, or `social`. `intensity` is one of `light`, `balanced`, or `strong`. Purpose and intensity default to `general` and `balanced` for backwards compatibility.

Important guarantees:

- the 8,000-word product limit still applies;
- credit cost is calculated by the same sanitization contract;
- reserve → generate → deterministic validation → commit is preserved;
- failed generation or validation releases the hold;
- operation IDs are idempotency boundaries shared with the existing transform surface;
- protected quotations, references, URLs, emails, dates, numerics and detected proper names retain the same validation rules;
- the API does not claim detector-proof or watermark-removal verification.

A developer key replaces the interactive Turnstile challenge for machine-to-machine requests, but API-key rate limits and the database-authoritative billing limits still apply.

## CLI

Node 22+ can use the committed zero-dependency CLI:

```bash
export PROVENANCE_API_KEY='pc_sk_...'
export PROVENANCE_API_URL='https://your-host.example'

npm run provenance:cli -- usage
npm run provenance:cli -- scan ./sample.txt conservative
npm run provenance:cli -- transform ./sample.txt natural work balanced
cat ./sample.txt | npm run provenance:cli -- scan - none
```

The CLI never prints the API key. Transform output and receipts are printed to stdout because they are the requested user result.

## Error contract

API errors use the standard Provenance Cleaner shape:

```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "A valid Bearer API key is required.",
    "requestId": "..."
  }
}
```

Common status codes:

- `400` invalid request;
- `401` invalid or revoked API key;
- `402` insufficient credits;
- `409` duplicate operation ID or API-key limit;
- `413` transform exceeds the product limit;
- `422` transform failed deterministic validation;
- `429` rate or spend limit;
- `503` dependent service unavailable.

## Database boundary

The private `ops.developer_api_keys` table is RLS-enabled and inaccessible to `anon` and `authenticated`. Management and resolution RPCs are executable only by `service_role`. `developer_phase9_status()` exposes only non-secret readiness evidence.


## Chrome safe editor

The repository includes a Manifest V3 extension in `extension/chrome`. It uses the same `/api/v1/transform` contract, supports mode/purpose/intensity, can replace selected text in editable fields, and keeps one in-memory undo record. The extension stores the developer API key and preferences only; selected source text and generated output are not written to extension storage.
