# Reverse engineering: foneg.com Reddit launch

Status: evidence capture + bounded integration plan  
Date: 2026-09-16  
Target project: Provenance Cleaner / Un-Claude  
Source thread: https://www.reddit.com/r/SaaS/comments/1wickl9/i_just_launched_my_saas_and_im_going_to_sleep/  
Linked site: https://foneg.com/

## Why this is deliberately bounded

The source is mutable. At review time the Reddit post still linked to `foneg.com`, but the live domain resolved to a page titled **“Epstein Files - Photo Archive”** rather than the SaaS described by commenters in the launch thread. The original launch UI therefore cannot be treated as a stable source of truth.

This document records only behavior that is directly evidenced by the thread or by the current live site. Anything else is marked as inference and must not be promoted to parity work until it is independently observed.

## Observed evidence

### Reddit launch

- The post title is “I just launched my SaaS and I’m going to sleep hoping for $1M”.
- The post links directly to `foneg.com` and contains no durable product description in the captured body.
- A contemporaneous commenter describes the launched product as **$10/month**.
- The same comment says the product is **offline / has no server involved** and argues that the site can be saved locally.
- The commenter compares the product’s function to something “free Claude can do”.
- The commenter criticizes the front end as AI-generated boilerplate.

These comments are user observations, not verified implementation details. They are useful for architecture clues, but not enough to reconstruct hidden behavior.

### Current live domain

At review time `foneg.com` presents an “Epstein Files - Photo Archive” page. Search results also surface an older/public Cloudflare Pages archive with the same title and an 18+ archival disclaimer. This is materially different from the SaaS described in the Reddit comments.

## High-confidence product/architecture clues

1. **Local-first execution was a visible selling/implementation property.**
   - Confidence: medium-high because it is explicitly described in the launch-thread feedback.
   - Unknown: which exact operation ran locally.

2. **The monetization model appears to have been a $10/month subscription.**
   - Confidence: medium because it is reported by a commenter, not captured from a pricing page.

3. **A client-only paid boundary is likely unenforceable.**
   - Confidence: high as a general architecture conclusion if the paid capability is fully delivered to the browser with no server entitlement or metering dependency.
   - This is an architectural lesson, not a claim that every foneg request was client-only.

4. **The original launch surface is no longer independently reproducible from the provided URL.**
   - Confidence: high. The current domain content no longer matches the launch-thread description.

## What this means for Un-Claude

Un-Claude already contains the safer version of the useful idea:

- deterministic text inspection executes in the browser;
- the scanner UI explicitly describes inspection as local and free;
- raw text is not intentionally persisted for local scan;
- authoritative billable cleaning/transform operations cross a server boundary and use account/credit state;
- Phase 9 also exposes server-authoritative developer API keys, usage, scan, and transform endpoints.

That means we should **not** reproduce an unenforceable client-only subscription gate. The reference is most useful as validation for a split product architecture:

### Free/local trust surface

Keep and strengthen:

- local deterministic inspection;
- no account required for inspection;
- local receipts/export;
- explicit network-boundary messaging;
- graceful behavior when the network is unavailable.

### Server-authoritative paid surface

Keep behind the existing trusted boundary:

- credit mutation;
- semantic/model transformations;
- paid sanitation if it remains monetized;
- subscription/pack entitlement;
- API-key authorization and usage accounting;
- idempotency and rate limits.

## Proposed integration slice

### Slice A — local-first/offline hardening

Goal: make the free scanner intentionally usable as a local-first capability without weakening billing.

Planned behavior:

1. Add explicit online/offline capability state to the scanner.
2. Preserve local scan and receipt export while offline.
3. Disable server-authoritative operations while offline with a precise explanation rather than a failed fetch.
4. Do **not** cache API responses, account state, transformed content, receipts containing user content, or payment state in a service worker.
5. If an installable/PWA shell is added, cache only immutable/public application assets needed for the local scanner and a non-sensitive offline shell.
6. Keep paid operations server-authoritative; no client-side entitlement bypass.

Acceptance criteria:

- local scan works with `navigator.onLine === false` after the shell has been loaded;
- receipt JSON can still be generated locally;
- paid clean/edit buttons cannot start a billable request while offline;
- no `/api/*` response is stored by the offline cache;
- no raw user text is written to persistent browser storage by the offline layer;
- existing online scan, billing, auth, transform, and developer API behavior is unchanged;
- unit/E2E coverage explicitly verifies the offline boundary.

### Slice B — recover original product evidence before feature-parity claims

Before implementing any additional foneg-specific feature, recover one of:

- archived screenshot/video of the original launch UI;
- stable public copy from the original pricing/product page;
- browser-network capture of the original application;
- author-provided feature description.

Until then, do not claim parity with foneg beyond the observed local-first architecture pattern.

## Clean-room constraints

- Do not copy branding, copy, assets, source code, or private implementation details.
- Reimplement only observable behavior or independently derived architecture.
- Keep the existing Provenance Cleaner truthfulness rules: no unsupported claims about authorship, detector evasion, provenance, or semantic equivalence.
- Preserve privacy and billing invariants already certified in the repository.

## Current repository anchor

This reverse-engineering branch starts from `main` at:

`8f3ad8001b0cd0f39956d14da4a9e873393baa9b`

That commit includes the merged Phase 9B developer API and automation work.
