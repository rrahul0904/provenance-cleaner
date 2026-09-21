# Unicode Reference Audit

Date: 2026-09-21

This audit records the actual Unicode rules enforced by Provenance Cleaner. The current public Un-Claude capabilities page is not directly reachable from the verification environment, so exact competitor labels are not guessed. The implementation intentionally prefers language integrity over blind deletion.

| Rule family | Code points | Default action | Reason |
| --- | --- | --- | --- |
| Zero Width Space | U+200B | Remove | Invisible spacing artifact in ordinary prose |
| Embedded BOM / Zero Width No-Break Space | U+FEFF | Remove | Safe when embedded inside pasted prose |
| Zero Width Non-Joiner | U+200C | Review/preserve | Linguistically meaningful in Persian/Arabic/Indic scripts |
| Zero Width Joiner | U+200D | Review/preserve | Meaningful in emoji sequences and multiple writing systems |
| Word Joiner | U+2060 | Review/preserve | Can express line-breaking intent |
| No-Break Space | U+00A0 | Review/preserve | Legitimate typography/common web content |
| Narrow No-Break Space | U+202F | Review/preserve | Legitimate typography and language usage |
| BiDi embedding/override controls | U+202A–U+202E | Review/preserve | Legitimate RTL/BiDi semantics; also security-relevant |
| BiDi isolate controls | U+2066–U+2069 | Review/preserve | Legitimate RTL/BiDi isolation |
| Unicode tag plane | U+E0000–U+E007F | Review/preserve | Some emoji flag sequences use tags |
| Typographic spaces | U+2000–U+200A, U+205F, U+3000 | Review/preserve | Legitimate spacing/typography |

## Verification contract

1. Scanning reports UTF-16 position, code point, character name/category and disposition.
2. Conservative cleaning automatically removes only `safe_remove` findings.
3. Review-sensitive findings remain in the output.
4. Cleaning is rescanned before a billable text-cleaning reservation is committed.
5. Aggressive mode exists at the deterministic library layer but is not used to silently mutate signed or language-sensitive content in the public billable flow.

Evidence: `src/lib/provenance/unicode.ts`, `tests/unicode.test.ts`, and `tests/unclaude-parity.test.ts`.
