import { describe, expect, it } from "vitest";
import {
  creditCostForInput,
  creditCostForText,
  creditCostForWords,
  GUEST_PROMO_CREDITS,
  isAcceptedFileKind,
  MAX_FILE_BYTES,
  MAX_REWRITE_WORDS,
  SIGNUP_PROMO_CREDITS,
  validateFileSize,
  validateRewriteWordCount,
} from "../src/lib/product-contract";

describe("feature-parity product contract", () => {
  it("uses the observed promotional-credit contract", () => { expect(GUEST_PROMO_CREDITS).toBe(2); expect(SIGNUP_PROMO_CREDITS).toBe(3); });
  it("prices text at one credit per 1000 words rounded up", () => { expect(creditCostForWords(1)).toBe(1); expect(creditCostForWords(1000)).toBe(1); expect(creditCostForWords(1001)).toBe(2); expect(creditCostForWords(2500)).toBe(3); expect(creditCostForText(Array.from({ length: 8000 }, () => "word").join(" "))).toBe(8); });
  it("prices supported metadata file jobs at one flat credit", () => { expect(creditCostForInput("docx")).toBe(1); expect(creditCostForInput("png")).toBe(1); expect(creditCostForInput("jpeg")).toBe(1); expect(creditCostForInput("txt", "one ".repeat(1001))).toBe(2); });
  it("enforces 7,999 / 8,000 / 8,001 rewrite boundaries", () => {
    const words = (count: number) => Array.from({ length: count }, () => "w").join(" ");
    expect(validateRewriteWordCount(words(7_999))).toEqual({ words: 7_999, ok: true });
    expect(validateRewriteWordCount(words(MAX_REWRITE_WORDS))).toEqual({ words: 8_000, ok: true });
    expect(validateRewriteWordCount(words(8_001))).toEqual({ words: 8_001, ok: false });
  });
  it("enforces just-below / exact / just-above 3.2 MiB", () => {
    expect(MAX_FILE_BYTES).toBe(Math.floor(3.2 * 1024 * 1024));
    expect(validateFileSize(MAX_FILE_BYTES - 1)).toBe(true);
    expect(validateFileSize(MAX_FILE_BYTES)).toBe(true);
    expect(validateFileSize(MAX_FILE_BYTES + 1)).toBe(false);
  });
  it("routes the observed input families", () => { expect(isAcceptedFileKind("paper.docx")).toBe("docx"); expect(isAcceptedFileKind("photo.PNG")).toBe("png"); expect(isAcceptedFileKind("photo.jpeg")).toBe("jpeg"); expect(isAcceptedFileKind("notes.txt")).toBe("txt"); expect(isAcceptedFileKind("archive.zip")).toBeNull(); });
});
