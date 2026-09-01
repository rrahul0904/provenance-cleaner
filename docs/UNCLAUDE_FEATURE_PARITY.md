# Un-Claude Clean-Room Feature Parity Matrix

This document tracks publicly observable reference behavior against Provenance Cleaner. It is a clean-room behavioral inventory: no proprietary source code, branding, protected copy, or private implementation details are copied.

| ID | Surface | Reference behavior | Current gap | Implementation task | Test/evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PAR-001 | Workbench | Paste text, upload file, try example, scan, clean, receipt, copy/download, account state | Partial | Unify workbench states and routing | E2E workbench matrix | OBSERVED |
| PAR-002 | Scan | Hidden-character scan is free and does not require an account | Verify exact current behavior | Make scan zero-credit, no-auth | Unit + E2E | OBSERVED |
| PAR-003 | Text | Pasted text supports hidden-char clean and optional semantic rewrite | Mostly present | Enforce exact routing/limits | Unit + E2E | OBSERVED |
| PAR-004 | TXT | .txt follows text pipeline and word-based pricing | Gap | Add .txt upload parsing/routing | Fixture E2E | OBSERVED |
| PAR-005 | DOCX | Hidden-char + metadata inspection/safe sanitation; no automatic semantic rewrite | Partial | Enforce file-only routing | DOCX fixture tests | OBSERVED |
| PAR-006 | PNG/JPG | Metadata inspection/safe sanitation only | Partial | Enforce image-only routing | PNG/JPEG fixture tests | OBSERVED |
| PAR-007 | Limits | DOCX/PNG/JPG max 3.2 MB; rewrite max 8,000 words | Gap | Shared server/client validation | Boundary tests | OBSERVED |
| PAR-008 | Unicode | Reference product claims nine invisible-character classes, names and positions findings, then rescans | Unknown exact nine | Build probe corpus; document observed classes; deterministic scan/clean | Probe + scanner tests | OBSERVED |
| PAR-009 | Metadata | EXIF/XMP/Office properties/generator metadata inspected and cleaned | Partial | Expand inspector/receipt | Fixture tests | OBSERVED |
| PAR-010 | C2PA | Reference removes provenance metadata; Provenance Cleaner preserves signed-provenance integrity | Intentional divergence | Keep inspection-first signed-provenance safety | C2PA regression tests | INTENTIONAL_DIVERGENCE |
| PAR-011 | Rewrite | Semantics-preserving rewrite with protected spans and deterministic validation | Mostly present | Add max-run/overlap/receipt parity and limits | Transform tests | OBSERVED |
| PAR-012 | Rewrite metrics | Longest shared run, wording changed %, length retained, figures/dates checked | Gap | Extend metrics + receipt | Unit + E2E | OBSERVED |
| PAR-013 | Guest | First signed-out clean creates browser guest identity | Partial | Lazy guest creation on clean only | E2E | OBSERVED |
| PAR-014 | Guest promo | First guest clean grants 2 credits once | Gap | DB idempotent promo grant | SQL + E2E | OBSERVED |
| PAR-015 | Signup promo | Account creation grants +3 credits once | Gap | Identity fingerprint + grant | SQL + auth E2E | OBSERVED |
| PAR-016 | Guest migration | Remaining guest credits/history atomically migrate to account | Gap/partial | Migration RPC and session cleanup | SQL + auth E2E | OBSERVED |
| PAR-017 | Guest cookie | One-year browser guest identity | Gap/verify | Dedicated secure guest cookie/session behavior | Cookie E2E | OBSERVED |
| PAR-018 | Auth | Email/password, sign in/out/reset; Google if configured | Partial | Complete account flows | Auth E2E | OBSERVED |
| PAR-019 | Account | Credit balance/history, purchase history, settings, deletion | Partial | Account dashboard and operations | Account E2E | OBSERVED |
| PAR-020 | History privacy | Operational metadata only; no content or filename | Partial | Enforce schema/UI privacy | SQL + log tests | OBSERVED |
| PAR-021 | Delete | Delete account/history; retain only keyed anti-abuse fingerprint and required payment records | Gap | Deletion RPC + UI confirmation | SQL + E2E | OBSERVED |
| PAR-022 | Pricing | 1 credit/1,000 words rounded up; DOCX/PNG/JPG flat 1 credit; credits do not expire | Partial | Shared pricing library | Unit tests | OBSERVED |
| PAR-023 | Packs | $4.99/10, $9.99/25, $24.99/100, no subscription | Present | Preserve/test | Stripe test | VERIFIED |
| PAR-024 | Failure billing | reserve -> work -> validate -> commit; failure -> release | Present | Preserve and surface reversal history | SQL/runtime smoke | VERIFIED |
| PAR-025 | US paid policy | Paid credits restricted to US customers | Gap | Checkout country validation or explicit intentional divergence | Stripe TEST | OBSERVED |
| PAR-026 | Refunds | Unspent purchased credits refundable within 30 days | Gap | FIFO refundable-balance model + support workflow | Unit/SQL/Stripe TEST | OBSERVED |
| PAR-027 | Pricing calculator | Interactive calculator uses same server pricing arithmetic | Gap | Shared calculator UI | Unit + E2E | OBSERVED |
| PAR-028 | Public pages | How it works, capabilities, mission, pricing, contact, FAQ, terms, privacy, cookies | Gap/partial | Original Provenance Cleaner pages | Route tests | OBSERVED |
| PAR-029 | Contact | Contact form opens mail client; site does not store message | Gap | mailto-only form | E2E + network assertion | OBSERVED |
| PAR-030 | Analytics | Cookieless PostHog, DNT respected, no submitted content/filenames | Gap | Optional privacy-safe analytics adapter | Unit + browser storage test | OBSERVED |
| PAR-031 | Bot protection | Cloudflare/Turnstile protects economic actions | Present | Preserve preview/prod separation | E2E/runtime | VERIFIED |
| PAR-032 | Privacy | Process -> return -> discard; only semantic rewrite goes to model provider | Mostly present | Audit temp-file cleanup/logging | Privacy tests | OBSERVED |
| PAR-033 | Marketing | Vendor status/evidence table uses independently verified official sources | Gap | Add sourced evidence view; original wording | Source audit | OBSERVED |
| PAR-034 | Safety claims | No guaranteed detector-bypass/undetectable claims | Stronger than reference positioning | Preserve truthful claims | Copy review | INTENTIONAL_DIVERGENCE |
| PAR-035 | Mobile/a11y | Responsive workbench/account/pricing and keyboard/screen-reader basics | Verify/partial | Responsive and accessibility pass | Playwright + axe if available | OBSERVED |

## Release gate

A launch-critical row may be `VERIFIED` or `INTENTIONAL_DIVERGENCE` only. `UNKNOWN` is not acceptable for a publicly observable release-critical behavior. Evidence must be attached in `docs/UNCLAUDE_PARITY_REPORT.md` as implementation progresses.
