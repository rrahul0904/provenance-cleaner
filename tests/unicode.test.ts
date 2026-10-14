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

  it("reports C0/C1 controls but preserves structural whitespace and NEL", () => {
    const text = "a\u0000b\tline\nnext\rrow\u007fend\u0090tail\u0085next";
    const receipt = scanText(text, "2026-10-13T00:00:00.000Z");
    expect(receipt.findings.map(({ codePoint }) => codePoint)).toEqual(["U+0000", "U+007F", "U+0090"]);
    expect(receipt.findings.every(({ category, disposition }) => category === "control_character" && disposition === "review")).toBe(true);
    expect(receipt.summary.byCategory.control_character).toBe(3);

    const conservative = sanitizeText(text);
    expect(conservative.output).toBe(text);
    expect(conservative.preservedForReview.map(({ codePoint }) => codePoint)).toEqual(["U+0000", "U+007F", "U+0090"]);

    const aggressive = sanitizeText(text, "aggressive");
    expect(aggressive.output).toBe("ab\tline\nnext\rrowendtail\u0085next");
  });

  it("covers every non-structural C0/C1 code point without flagging line whitespace", () => {
    const expected = [
      ...Array.from({ length: 0x20 }, (_, codePoint) => codePoint).filter((codePoint) => ![0x09, 0x0a, 0x0d].includes(codePoint)),
      ...Array.from({ length: 0x21 }, (_, offset) => 0x7f + offset).filter((codePoint) => codePoint !== 0x85),
    ];
    const source = String.fromCodePoint(...expected);
    const receipt = scanText(source, "2026-10-13T00:00:00.000Z");

    expect(receipt.findings.map(({ codePoint }) => Number.parseInt(codePoint.slice(2), 16))).toEqual(expected);
    expect(receipt.summary.reviewRequired).toBe(expected.length);
    expect(sanitizeText(source).output).toBe(source);
    expect(sanitizeText(source, "aggressive").output).toBe("");
  });

  it("keeps UTF-16 source offsets and canonical Unicode sequences unchanged", () => {
    const decomposed = "Cafe\u0301 👩\u200D👩";
    const withFinding = `${decomposed}\u0000tail`;
    const receipt = scanText(withFinding, "2026-10-13T00:00:00.000Z");
    const nullFinding = receipt.findings.find(({ codePoint }) => codePoint === "U+0000");
    expect(nullFinding?.index).toBe(decomposed.length);
    expect(sanitizeText(withFinding).output).toBe(withFinding);
    expect(sanitizeText(`Cafe\u0301\u200B`).output).toBe("Cafe\u0301");
    expect(sanitizeText(`Cafe\u0301\u200B`).output.normalize("NFC")).not.toBe(sanitizeText(`Cafe\u0301\u200B`).output);
  });

  it("classifies each supported invisible family consistently", () => {
    const fixtures = [
      ["\u200B", "zero_width", "safe_remove"],
      ["\u200C", "format_control", "review"],
      ["\u202E", "bidi_control", "review"],
      ["\u00A0", "unusual_space", "review"],
      ["\u{E0061}", "unicode_tag", "review"],
      ["\u0001", "control_character", "review"],
    ] as const;

    for (const [character, category, disposition] of fixtures) {
      const first = scanText(`x${character}y`, "2026-10-13T00:00:00.000Z");
      const second = scanText(`x${character}y`, "2026-10-13T00:00:00.000Z");
      expect(first.findings).toHaveLength(1);
      expect(first.findings[0]).toMatchObject({ category, disposition, index: 1 });
      expect(second).toEqual(first);
    }
  });

  it("preserves language-sensitive joiners and reports Arabic/RTL marks", () => {
    const source = "می\u200Cروم क्\u200Dषत्र \u061Cالعربية\u200F";
    const receipt = scanText(source, "2026-10-13T00:00:00.000Z");
    expect(receipt.findings.map(({ codePoint }) => codePoint)).toEqual(["U+200C", "U+200D", "U+061C", "U+200F"]);
    expect(receipt.findings.map(({ category }) => category)).toEqual([
      "format_control", "format_control", "bidi_control", "bidi_control",
    ]);
    expect(sanitizeText(source).output).toBe(source);
    expect(sanitizeText(source).preservedForReview).toHaveLength(4);
  });
});
