import type { PreparedText, ProtectedKind, ProtectedSpan } from "./types";

interface Candidate {
  kind: ProtectedKind;
  start: number;
  end: number;
  value: string;
}

const PATTERNS: Array<{ kind: ProtectedKind; regex: RegExp }> = [
  { kind: "code", regex: /`[^`\n]{1,500}`/g },
  { kind: "url", regex: /https?:\/\/[^\s<>"'\])}]+/gi },
  { kind: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { kind: "quote", regex: /“[^”\n]{1,800}”|"[^"\n]{1,800}"/g },
  { kind: "citation", regex: /\[[0-9,;\s–—-]+\]|\([A-Z][A-Za-z'’-]+(?:\s+et al\.)?,?\s+\d{4}[a-z]?\)/g },
  { kind: "date", regex: /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi },
  { kind: "number", regex: /(?<![\p{L}\p{N}_])(?:[+-]\s*)?(?:[$€£¥]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?![\p{L}\p{N}_])/gu },
];

function candidatesFor(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const { kind, regex } of PATTERNS) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      if (match.index === undefined) continue;
      candidates.push({
        kind,
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
      });
    }
  }
  return candidates;
}

function chooseNonOverlapping(candidates: Candidate[]) {
  const chosen: Candidate[] = [];
  const sorted = [...candidates].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  for (const candidate of sorted) {
    const overlaps = chosen.some((item) => candidate.start < item.end && item.start < candidate.end);
    if (!overlaps) chosen.push(candidate);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

export function prepareProtectedText(text: string): PreparedText {
  const selected = chooseNonOverlapping(candidatesFor(text));
  const spans: ProtectedSpan[] = selected.map((item, id) => ({
    ...item,
    id,
    token: `[[PROTECTED_${String(id).padStart(4, "0")}]]`,
  }));

  let cursor = 0;
  let protectedText = "";
  for (const span of spans) {
    protectedText += text.slice(cursor, span.start) + span.token;
    cursor = span.end;
  }
  protectedText += text.slice(cursor);

  return { original: text, protectedText, spans };
}

export function tokenOccurrenceCount(text: string, token: string) {
  return text.split(token).length - 1;
}

export function restoreProtectedText(text: string, spans: ProtectedSpan[]) {
  let restored = text;
  for (const span of spans) restored = restored.split(span.token).join(span.value);
  return restored;
}

export function extractInvariantValues(text: string) {
  const prepared = prepareProtectedText(text);
  return prepared.spans
    .filter((span) => span.kind !== "quote" && span.kind !== "code" && span.kind !== "citation")
    .map((span) => `${span.kind}:${span.value}`)
    .sort();
}
