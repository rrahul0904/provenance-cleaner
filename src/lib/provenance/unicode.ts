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
  [0x00ad, { category: "format_control", disposition: "review", name: "SOFT HYPHEN", description: "Invisible discretionary hyphen; it may affect line wrapping and word breaks." }],
  [0x034f, { category: "format_control", disposition: "review", name: "COMBINING GRAPHEME JOINER", description: "Invisible grapheme control that may be meaningful in complex scripts." }],
  [0x180e, { category: "format_control", disposition: "review", name: "MONGOLIAN VOWEL SEPARATOR", description: "Format character that may be meaningful in Mongolian text." }],
  [0x061c, { category: "bidi_control", disposition: "review", name: "ARABIC LETTER MARK", description: "Bidirectional mark used in Arabic text; preserve by default and review its context." }],
  [0x200e, { category: "bidi_control", disposition: "review", name: "LEFT-TO-RIGHT MARK", description: "Bidirectional mark that may be required for mixed-direction text." }],
  [0x200f, { category: "bidi_control", disposition: "review", name: "RIGHT-TO-LEFT MARK", description: "Bidirectional mark that may be required for mixed-direction text." }],
  [0x00a0, { category: "unusual_space", disposition: "review", name: "NO-BREAK SPACE", description: "Common in copied web content and typography; not removed in conservative mode." }],
  [0x202f, { category: "unusual_space", disposition: "review", name: "NARROW NO-BREAK SPACE", description: "Used legitimately in typography and some languages." }],
]);

const C0_CONTROL_NAMES = new Map<number, string>([
  [0x00, "NULL"], [0x01, "START OF HEADING"], [0x02, "START OF TEXT"], [0x03, "END OF TEXT"],
  [0x04, "END OF TRANSMISSION"], [0x05, "ENQUIRY"], [0x06, "ACKNOWLEDGE"], [0x07, "BELL"],
  [0x08, "BACKSPACE"], [0x0b, "LINE TABULATION"], [0x0c, "FORM FEED"], [0x0e, "SHIFT OUT"],
  [0x0f, "SHIFT IN"], [0x10, "DATA LINK ESCAPE"], [0x11, "DEVICE CONTROL ONE"],
  [0x12, "DEVICE CONTROL TWO"], [0x13, "DEVICE CONTROL THREE"], [0x14, "DEVICE CONTROL FOUR"],
  [0x15, "NEGATIVE ACKNOWLEDGE"], [0x16, "SYNCHRONOUS IDLE"], [0x17, "END OF TRANSMISSION BLOCK"],
  [0x18, "CANCEL"], [0x19, "END OF MEDIUM"], [0x1a, "SUBSTITUTE"], [0x1b, "ESCAPE"],
  [0x1c, "FILE SEPARATOR"], [0x1d, "GROUP SEPARATOR"],
  [0x1e, "RECORD SEPARATOR"], [0x1f, "UNIT SEPARATOR"], [0x7f, "DELETE"],
]);

function controlRule(codePoint: number): Rule | null {
  const isC0 = codePoint <= 0x1f && ![0x09, 0x0a, 0x0d].includes(codePoint);
  const isC1 = codePoint >= 0x7f && codePoint <= 0x9f && codePoint !== 0x85;
  if (!isC0 && !isC1) return null;

  return {
    category: "control_character",
    disposition: "review",
    name: C0_CONTROL_NAMES.get(codePoint) ?? "C1 CONTROL",
    description: "Non-printing control character. It may be structural or legacy data; review before removal.",
  };
}

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
  return EXACT_RULES.get(codePoint) ?? controlRule(codePoint) ?? rangeRule(codePoint);
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
    control_character: 0,
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
