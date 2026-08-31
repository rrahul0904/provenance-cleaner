# Phase 3 — Semantics-preserving editing

## Implemented

- Four editing goals: natural, clarity, concise, and formal.
- Explicit 20–12,000 character request bounds.
- Protected-span extraction before any model call for:
  - URLs
  - email addresses
  - dates
  - numeric values
  - citations
  - quoted passages
  - inline code
- Immutable placeholder tokens that must survive exactly once.
- Bounded paragraph/sentence chunk planning for long inputs.
- Vercel AI Gateway integration through AI SDK 7.
- Default model: `mistral/mistral-medium-3.5`, overridable with `TRANSFORM_MODEL`.
- Maximum of two generation attempts.
- Deterministic post-generation checks for:
  - missing or duplicated protected spans
  - added/removed/changed factual invariant values
  - mode-specific length bounds
- Transformation receipt metrics:
  - protected-span coverage
  - input/output word count and length ratio
  - longest shared contiguous word run
  - 3-gram overlap
- No database write and no raw-text application logging in this phase.

## Important semantics

Phrase overlap is a transparency metric, not an optimization target. Phase 3 does not try to minimize overlap in order to evade AI detectors or provenance systems.

A `Validated` edit means the deterministic checks above passed. It does not prove semantic equivalence in the formal sense, prove human authorship, or establish that any external detector will classify the text in a particular way.

Named entities are not yet hard-protected by a general-purpose NER system because naive capitalization heuristics can freeze ordinary sentence starts and create false confidence. Entity-aware validation belongs in a later validator wave using a dedicated extraction model or maintained NER library.

## Data boundary

Text inspection and span protection run locally/in-process. The source is sent to the configured AI Gateway model only after the user explicitly starts an edit. Before transmission, protected values are replaced by immutable placeholders. The application does not intentionally persist the source or output.

AI Gateway/provider data handling is governed separately by the configured provider and Vercel settings; the UI should not imply that an AI edit is a fully local operation.

## Environment

Preferred on Vercel: link the project and use Vercel OIDC for AI Gateway authentication.

For local or non-Vercel execution, `AI_GATEWAY_API_KEY` can be supplied. Never commit a real key.

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Remaining validation work

- run the full test/lint/build suite on a working CI runner
- create a Vercel preview for the stacked Phase 3 branch
- exercise successful and failed AI Gateway requests in browser E2E tests
- add entity-aware validation
- evaluate an optional independent semantic-similarity validator before calling factual preservation complete
- add per-IP/user rate limiting before exposing the paid model endpoint publicly
