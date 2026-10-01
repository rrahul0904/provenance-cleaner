# RE-224 — Quirón clean-room donor analysis

Date: 2026-09-23  
Canonical destination: `rrahul0904/provenance-cleaner`  
Source references:
- Reddit: https://www.reddit.com/r/claudeskills/s/7r6ie4l5gr
- Upstream: https://github.com/ilien-dev/quiron

## Decision

Quirón is a **capability donor** for Provenance Cleaner, not a standalone clone.

The useful product primitive is not "make AI text undetectable." It is a deterministic, post-edit
**style-balance meter** that can show whether a rewrite moved toward a chosen human-authored
reference range or overshot into unnaturally clipped/plain prose.

Provenance Cleaner must preserve its existing safer positioning:
- no AI-detector-bypass claims;
- no "undetectable" promises;
- preserve facts, URLs, citations, quotations, dates, numerics and named entities;
- make provenance and transformation receipts visible;
- prefer writer-authored notes/samples when tuning voice.

## What is observed upstream

The public Quirón project exposes an agent skill plus deterministic scripts and evaluation material.

Observed behavior:
1. Inspect a draft for recurring model-writing habits.
2. Rewrite conservatively.
3. Measure the rewritten prose with deterministic style features.
4. Compare each feature to a human-authored reference band.
5. Distinguish "inside reference range" from residual model-leaning behavior and from **overshoot**.
6. Optionally use the writer's own samples so stable personal habits are not normalized away.
7. Report measurements instead of asking the model to grade its own output.

The public project describes 33 editing-pattern checks and a 23-feature meter. Its metric family
covers sentence-length variation, sentence and word length, nominalization/adverb/passive rates,
lexical diversity, first-person/contraction/question rates, opener repetition, punctuation,
triads/participial clauses, paragraph length and heading density.

The public implementation also has calibration workflows for human reference corpora and optional
AI comparison corpora, minimum-text gating, language/register-specific profiles, and tolerance at
band edges to avoid one-token/punctuation jitter.

## License / clean-room boundary

Upstream is AGPL-3.0 and its NOTICE states that the skill, scripts, word lists, evaluation data and
brand assets are covered, with an attribution term for conveyed/network-modified versions.

Therefore this repository will **not copy** upstream code, prompts, word lists, thresholds,
reference bands, evaluation texts or branding. The donor is used only to identify externally
observable product behavior and general measurement concepts.

Any native implementation here must:
- be independently written in TypeScript to fit Provenance Cleaner's stack;
- use independently defined feature extractors and independently sourced/owned calibration data;
- record the data/source license and baseline version;
- have tests demonstrating independent behavior.

## End-to-end target workflow

```
input text
  -> deterministic content/provenance scan
  -> purpose + protected-span policy
  -> optional writer notes / writer sample
  -> semantic rewrite
  -> deterministic style measurement (before/after)
  -> reference-band comparison
  -> bounded retry only when validation fails or style clearly overshoots
  -> final validation
  -> receipt with provenance + metric/baseline version
```

The meter is descriptive. It must not emit a binary "human/AI" verdict or a detector-evasion score.

## Independent Phase A contract

Implement a small native `StyleBalanceMeter` with an intentionally independent feature set:

- mean sentence length;
- sentence-length coefficient of variation;
- words per paragraph;
- heading density;
- list-item density;
- question rate;
- first-person rate;
- contraction rate;
- punctuation mix (comma / semicolon / parenthesis / dash rates);
- lexical diversity using a documented, deterministic implementation.

Each feature returns:
- observed value;
- optional reference low/median/high;
- state: `within_range | below_range | above_range | insufficient_text`;
- optional directional explanation such as "more repetitive than reference" or "more fragmented than reference".

Do **not** label the out-of-range side as "AI" in the API contract.

### Reference profiles

Phase A supports:
1. `generic-prose-v1` — an independently curated, license-documented reference corpus;
2. `writer-sample-v1` — an ephemeral user-provided sample profile.

Writer samples should be processed locally/in-memory where possible. Persist only an aggregate profile
and/or content hash when a user explicitly asks to save a profile.

### API / product surfaces

Extend the semantic-transform result with:
```ts
styleMeter?: {
  profileId: string
  profileVersion: string
  before: StyleMeasurement
  after: StyleMeasurement
  warnings: string[]
}
```

Expose the same deterministic contract to:
- web editor;
- developer API;
- CLI;
- Chrome extension where feasible without network-only dependence.

The UI should explain that the metric is a writing-quality reference, not an AI-authorship detector.

## Acceptance tests

Phase A is repository-complete only when all of these are true:

1. Same input + same profile produces identical measurements.
2. Short text fails closed as `insufficient_text`; no fabricated score.
3. Both sides of a band are represented without converting them into "AI" / "human" labels.
4. A deliberately clipped rewrite can be reported as overshooting a configured writer/reference profile.
5. User-supplied writer samples affect only the requested profile and are tenant/session isolated.
6. Protected facts/entities remain unchanged through any rewrite path.
7. Receipt records profile ID/version and before/after measurement hashes.
8. Existing unit, lint, build, Playwright and release gates remain green.

## Later slices

Phase B:
- independent corpus calibration pipeline with provenance/license manifest;
- register-specific profiles (technical docs, internal notes, blog, fiction where appropriate);
- writer-habit comparison and confidence/coverage metadata.

Phase C:
- local/offline metric calculation in browser/extension;
- per-feature explanations and "why this changed" diff;
- optional agent-skill packaging that calls the same Provenance Cleaner contract.

## Explicit non-goals

- reproducing Quirón's 33-rule checklist verbatim;
- reproducing its 23-feature thresholds or word lists;
- claiming parity with its exact scores;
- training or optimizing against commercial AI detectors;
- promising that transformed text will be classified as human;
- facilitating academic, hiring, review or public-attribution deception.

## Verification state

As of this branch creation, the source behavior and license boundary are researched and mapped.
The native StyleBalanceMeter is **not yet implemented**. No implementation, hosted, detector-evasion
or production-readiness claim should be made from this document alone.

## Smallest next executable change

Add `src/lib/style-balance-meter.ts` plus unit tests for the independent Phase A metric contract,
using only synthetic fixtures initially. Do not add a reference corpus until its provenance/license
manifest exists.