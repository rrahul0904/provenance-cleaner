import { describe, expect, it } from "vitest";
import { sanitizeText, scanText } from "../src/lib/provenance/unicode";

describe("Unicode provenance scanner", () => {
  it("finds a zero-width space and marks it safe to remove", () => {
    const receipt = scanText("hello\u200Bworld", "2026-08-31T00:00:00.000Z");
    expect(receipt.summary.total).toBe(1);
    expect(receipt.summary.safeToRemove).toBe(1);
    expect(receipt.findings[0].codePoint).toBe("U+200B");
  });

  it("preserves ZWJ in conservative mode", () => {
    const text = "family 👩\u200D👩\u200D👧\u200D👦";
    const result = sanitizeText(text, "conservative");
    expect(result.output).toBe(text);
    expect(result.preservedForReview.length).toBe(3);
  });

  it("flags bidi controls for review", () => {
    const receipt = scanText("abc\u202Edef");
    expect(receipt.summary.reviewRequired).toBe(1);
    expect(receipt.findings[0].category).toBe("bidi_control");
  });

  it("removes safe hidden characters without changing visible text", () => {
    const result = sanitizeText("a\u200Bb\uFEFFc", "conservative");
    expect(result.output).toBe("abc");
    expect(result.removed).toHaveLength(2);
  });
});
