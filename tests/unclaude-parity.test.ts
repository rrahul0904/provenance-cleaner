import { describe, expect, it } from "vitest";
import { CREDIT_PACKS } from "../src/lib/billing/catalog";
import {
  GUEST_PROMO_CREDITS,
  MAX_FILE_BYTES,
  MAX_REWRITE_WORDS,
  SIGNUP_PROMO_CREDITS,
  creditCostForInput,
  validateFileSize,
  validateRewriteWordCount,
} from "../src/lib/product-contract";
import { sanitizeText, scanText } from "../src/lib/provenance/unicode";
import { planSanitizationJob } from "../src/lib/sanitization";
import {
  TRANSFORM_MODES,
  prepareProtectedText,
  unavailableTextWatermarkVerifier,
  validateTransformedDraft,
} from "../src/lib/transform";

describe("Un-Claude clean-room parity release contract", () => {
  it("locks the observed limits, promotions, credit arithmetic and one-time packs", () => {
    expect(MAX_FILE_BYTES).toBe(Math.floor(3.2 * 1024 * 1024));
    expect(validateFileSize(MAX_FILE_BYTES)).toBe(true);
    expect(validateFileSize(MAX_FILE_BYTES + 1)).toBe(false);

    const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");
    expect(validateRewriteWordCount(words(8_000))).toEqual({ words: MAX_REWRITE_WORDS, ok: true });
    expect(validateRewriteWordCount(words(8_001)).ok).toBe(false);

    expect(GUEST_PROMO_CREDITS).toBe(2);
    expect(SIGNUP_PROMO_CREDITS).toBe(3);
    expect(creditCostForInput("txt", words(1_001))).toBe(2);
    expect(creditCostForInput("docx")).toBe(1);
    expect(creditCostForInput("png")).toBe(1);
    expect(creditCostForInput("jpeg")).toBe(1);

    expect(CREDIT_PACKS.starter).toMatchObject({ credits: 10, priceUsd: 4.99 });
    expect(CREDIT_PACKS.plus).toMatchObject({ credits: 25, priceUsd: 9.99 });
    expect(CREDIT_PACKS.pro).toMatchObject({ credits: 100, priceUsd: 24.99 });
  });

  it("detects the hidden-Unicode families without blindly deleting language-sensitive controls", () => {
    const source = "A\u200BB\uFEFFC\u200CD\u200DE\u2060F\u00A0G\u202FH\u202EI\u2066J\u{E0061}K\u2009L";
    const scan = scanText(source);
    expect(scan.summary.total).toBeGreaterThanOrEqual(11);
    expect(scan.summary.byCategory.zero_width).toBe(2);
    expect(scan.summary.byCategory.format_control).toBeGreaterThanOrEqual(3);
    expect(scan.summary.byCategory.bidi_control).toBeGreaterThanOrEqual(2);
    expect(scan.summary.byCategory.unicode_tag).toBe(1);
    expect(scan.summary.byCategory.unusual_space).toBeGreaterThanOrEqual(3);

    const cleaned = sanitizeText(source, "conservative");
    expect(cleaned.output).not.toContain("\u200B");
    expect(cleaned.output).not.toContain("\uFEFF");
    expect(cleaned.output).toContain("\u200C");
    expect(cleaned.output).toContain("\u200D");
    expect(cleaned.output).toContain("\u202E");
    expect(cleaned.preservedForReview.length).toBeGreaterThan(0);
  });

  it("keeps free inspection separate from server-authoritative billable work", () => {
    const inspect = planSanitizationJob({ kind: "png", intent: "inspect", bytes: 1024 });
    expect(inspect.credits).toBe(0);
    expect(inspect.stages).toEqual(["inspect", "receipt"]);
    expect(inspect.serverAuthoritativeBilling).toBe(false);

    const fileClean = planSanitizationJob({ kind: "png", intent: "sanitize", bytes: 1024 });
    expect(fileClean.credits).toBe(1);
    expect(fileClean.stages).toEqual(["inspect", "plan", "reserve", "sanitize", "validate", "commit", "receipt"]);
    expect(fileClean.ephemeralContentProcessing).toBe(true);

    expect(() => planSanitizationJob({ kind: "png", intent: "sanitize", bytes: 1024, hasProvenance: true }))
      .toThrow(/provenance/i);
    expect(() => planSanitizationJob({ kind: "docx", intent: "rewrite", bytes: 1024 }))
      .toThrow(/rewriting is available only/i);
  });

  it("enforces parity rewriting while protecting factual material", () => {
    expect(TRANSFORM_MODES).toContain("parity");
    const prepared = prepareProtectedText(
      'Rahul Singh reported revenue of $1,234.50 on August 31, 2026 at https://example.com and said "Keep this quote unchanged."',
    );
    const kinds = prepared.spans.map((span) => span.kind);
    expect(kinds).toEqual(expect.arrayContaining(["entity", "number", "date", "url", "quote"]));

    const tokens = Object.fromEntries(prepared.spans.map((span) => [span.kind, span.token])) as Record<string, string>;
    const draft = `${tokens.entity} documented ${tokens.number} in revenue on ${tokens.date}; details appeared at ${tokens.url}, while stating ${tokens.quote}`;
    const validation = validateTransformedDraft(prepared, draft, "parity");

    expect(validation.checks.protectedSpansPreserved).toBe(true);
    expect(validation.checks.numericDateEntityPreserved).toBe(validation.checks.numericDateEntityExpected);
    expect(validation.checks.quoteReferencePreserved).toBe(validation.checks.quoteReferenceExpected);
  });

  it("never claims statistical-watermark verification without a legitimate detector", async () => {
    const result = await unavailableTextWatermarkVerifier.verify("example");
    expect(result).toMatchObject({ available: false, status: "unavailable" });
    expect(result.note).toMatch(/do not prove watermark removal/i);
  });
});
