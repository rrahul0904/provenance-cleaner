# Reverse-Engineering Notes: Un-Claude

This document captures reproducible product mechanics rather than copying branding, proprietary content, or unverifiable claims.

## Observed product pattern

- free/low-friction scanning
- paid cleaning via credits
- deterministic cleaning for invisible Unicode and file metadata
- optional model-assisted rewriting
- transformation receipt that makes changes legible
- ephemeral-content privacy positioning

## Reproduction strategy

Build the deterministic components first because they can be tested exactly. Treat statistical watermark rewriting as an optional transformation pipeline with semantic and factual validation, not as a guaranteed detector bypass.

## Differentiators for this implementation

- conservative linguistic handling by default
- explicit finding disposition (`safe_remove` vs `review`)
- receipts as a first-class schema/API object
- local-first text scanning
- multi-provider rewrite architecture later
- broader document privacy/provenance positioning
