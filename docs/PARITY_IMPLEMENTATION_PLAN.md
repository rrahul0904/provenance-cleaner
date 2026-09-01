# Feature-Parity Implementation Plan

This branch extends the existing controlled-launch application; it does not replace the architecture.

## Wave A — deterministic product contract
- free scan/no-auth path
- exact input routing for text, TXT, DOCX, PNG, JPEG
- 3.2 MB file limit
- 8,000-word rewrite limit
- shared credit-pricing arithmetic
- receipt metrics and validation boundaries

## Wave B — account and credit parity
- lazy guest identity on first clean
- idempotent 2-credit guest promotion
- idempotent 3-credit signup promotion
- guest-to-account migration
- privacy-safe credit history
- account deletion and keyed anti-abuse fingerprint

## Wave C — purchase/refund/public UX
- pricing calculator
- current fixed packs
- geography policy and/or explicit product policy divergence
- refundable purchased-credit accounting
- account/settings/history UX
- original public pages/contact/privacy/cookie content

## Wave D — analytics, mobile, accessibility and production
- optional cookieless analytics with DNT
- responsive/a11y pass
- real Preview runtime smoke
- release CI
- ordered stack merge
- final production verification

All changes must preserve append-only billing semantics, service-role boundaries, signed-webhook authority, Turnstile production protections, privacy-safe logging, and signed-provenance integrity.
