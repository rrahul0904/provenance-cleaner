# Architecture

## Product boundary

The platform separates four concerns:

1. deterministic text inspection
2. file metadata/provenance inspection and sanitization
3. optional semantic rewriting with factual invariants
4. receipts, accounts, billing, and audit history

## Target architecture

```text
Browser / Next.js
  ├─ text scanner (client-safe)
  ├─ scan API
  ├─ auth + account
  └─ upload orchestration
       │
       ├─ Unicode engine
       ├─ Metadata engine
       │    ├─ image EXIF/XMP
       │    ├─ C2PA inspection
       │    ├─ DOCX properties
       │    └─ PDF metadata
       ├─ Rewrite engine (optional)
       │    ├─ protected-span extraction
       │    ├─ non-origin LLM
       │    ├─ entity/number/date validation
       │    └─ overlap + semantic checks
       └─ Receipt engine

Supabase
  ├─ auth
  ├─ operation ledger
  ├─ credit ledger
  └─ receipt metadata (never raw content by default)

Stripe
  └─ credit packs / webhooks
```

## Privacy defaults

- Text scanning should remain client-side whenever practical.
- Uploaded files are processed ephemerally; raw bytes are not persisted by default.
- Receipts store structural metrics and hashes, not document content.
- Logging must redact pasted content and uploaded file bytes.
