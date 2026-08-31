import type {
  FindingCategory,
  FindingDisposition,
  SanitizeReceipt,
  TextFinding,
  TextScanReceipt,
} from "./types";

type Rule = {
  category: FindingCategory;
  disposition: FindingDisposition;
  name: string;
  description: string;
};

const EXACT_RULES = new Map<number, Rule>([
  [0x200b, { category: "zero_width", disposition: "safe_remove", name: "ZERO WIDTH SPACE", description: "Invisible spacing character that is usually unnecessary in ordinary prose." }],
  [0xfeff, { category: "zero_width", disposition: "safe_remove", name: "ZERO WIDTH NO-BREAK SPACE / BOM", description: "Usually safe to remove when embedded inside pasted text." }],
  [0x200c, { category: "format_control", disposition: "review", name: "ZERO WIDTH NON-JOINER", description: "May be linguistically meaningful in Persian, Arabic, Indic scripts, and other writing systems." }],
  [0x200d, { category: "format_control", disposition: "review", name: "ZERO WIDTH JOINER", description: "May be meaningful in emoji sequences and several writing systems." }],
  [0x2060, { category: "format_control", disposition: "review", name: "WORD JOINER", description: "Invisible formatting control; review before removal because it can express line-breaking intent." }],
  [0x00a0, { category: "unusual_space", disposition: "review", name: "NO-BREAK SPACE", description: "Common in copied web content and typography; not removed in conservative mode." }],
  [0x202f, { category: "unusual_space", disposition: "review", name: "NARROW NO-BREAK SPACE", description: "Used legitimately in typography and some languages." }],
]);

function rangeRule(codePoint: number): Rule | null {
  if (codePoint >= 0x202a && codePoint <= 0x202e) {
    return {
      category: "bidi_control",
      disposition: "review",
      name: "BIDIRECTIONAL EMBEDDING/OVERRIDE CONTROL",
      description: "Directionality control. It can be legitimate in bidirectional text and can also conceal text ordering changes.",
    };
  }
  if (codePoint >= 0x2066 && codePoint <= 0x2069) {
    return {
      category: "bidi_control",
      disposition: "review",
      name: "BIDIRECTIONAL ISOLATE CONTROL",
      description: "Directionality isolate. Preserve by default unless the document is known not to require RTL/BiDi formatting.",
    };
  }
  if (codePoint >= 0xe0000 && codePoint <= 0xe007f) {
    return {
      category: "unicode_tag",
      disposition: "review",
      name: "UNICODE TAG CHARACTER",
      description: "Invisible tag-plane character. Some emoji flag sequences use tags, so removal requires review.",
    };
  }
  if (
    (codePoint >= 0x2000 && codePoint <= 0x200a) ||
    codePoint === 0x205f ||
    codePoint === 0x3000
  ) {
    return {
      category: "unusual_space",
      disposition: "review",
      name: "TYPOGRAPHIC SPACE",
      description: "Non-ASCII spacing character. It may be intentional typography.",
    };
  }
  return null;
}

function classify(codePoint: number): Rule | null {
  return EXACT_RULES.get(codePoint) ?? rangeRule(codePoint);
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function scanText(text: string, scannedAt = new Date().toISOString()): TextScanReceipt {
  const findings: TextFinding[] = [];
  let utf16Index = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    const rule = classify(codePoint);
    if (rule) {
      findings.push({
        id: `u-${utf16Index}-${codePoint.toString(16)}`,
        category: rule.category,
        disposition: rule.disposition,
        index: utf16Index,
        codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
        characterName: rule.name,
        description: rule.description,
      });
    }
    utf16Index += char.length;
  }

  const byCategory: TextScanReceipt["summary"]["byCategory"] = {
    zero_width: 0,
    bidi_control: 0,
    unicode_tag: 0,
    unusual_space: 0,
    format_control: 0,
  };
  for (const finding of findings) byCategory[finding.category] += 1;

  return {
    version: "text-scan-v1",
    scannedAt,
    input: {
      characters: text.length,
      codePoints: Array.from(text).length,
      words: wordCount(text),
    },
    findings,
    summary: {
      total: findings.length,
      safeToRemove: findings.filter((f) => f.disposition === "safe_remove").length,
      reviewRequired: findings.filter((f) => f.disposition === "review").length,
      byCategory,
    },
  };
}

export function sanitizeText(
  text: string,
  mode: SanitizeReceipt["mode"] = "conservative",
): SanitizeReceipt {
  const scan = scanText(text);
  const removed: TextFinding[] = [];
  const preservedForReview: TextFinding[] = [];
  const findingsByIndex = new Map(scan.findings.map((finding) => [finding.index, finding]));
  let output = "";
  let utf16Index = 0;

  for (const char of text) {
    const cp = char.codePointAt(0)!;
    const rule = classify(cp);
    if (!rule) {
      output += char;
      utf16Index += char.length;
      continue;
    }

    const finding = findingsByIndex.get(utf16Index);
    const shouldRemove = rule.disposition === "safe_remove" || mode === "aggressive";

    if (shouldRemove) {
      if (finding) removed.push(finding);
    } else {
      output += char;
      if (finding) preservedForReview.push(finding);
    }
    utf16Index += char.length;
  }

  return { mode, removed, preservedForReview, output };
}
