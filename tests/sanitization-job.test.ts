import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES } from "../src/lib/product-contract";
import { planSanitizationJob, SanitizationContractError } from "../src/lib/sanitization";

describe("unified sanitization job contract", () => {
  it("keeps inspection free and local", () => {
    const plan = planSanitizationJob({ kind: "text", intent: "inspect", text: "hello" });
    expect(plan.credits).toBe(0);
    expect(plan.stages).toEqual(["inspect", "receipt"]);
    expect(plan.serverAuthoritativeBilling).toBe(false);
  });

  it("routes text and TXT sanitation through shared word-based economics", () => {
    expect(planSanitizationJob({ kind: "text", intent: "sanitize", text: "one ".repeat(1001) }).credits).toBe(2);
    expect(planSanitizationJob({ kind: "txt", intent: "sanitize", text: "one ".repeat(1001) }).credits).toBe(2);
  });

  it("routes DOCX/PNG/JPEG sanitation as one-credit jobs", () => {
    for (const kind of ["docx", "png", "jpeg"] as const) expect(planSanitizationJob({ kind, intent: "sanitize", bytes: MAX_FILE_BYTES }).credits).toBe(1);
  });

  it("rejects oversize files and rewrites before billing", () => {
    expect(() => planSanitizationJob({ kind: "png", intent: "sanitize", bytes: MAX_FILE_BYTES + 1 })).toThrow(SanitizationContractError);
    const tooMany = Array.from({ length: 8001 }, () => "word").join(" ");
    expect(() => planSanitizationJob({ kind: "text", intent: "rewrite", text: tooMany })).toThrow(/8,000 words/i);
  });

  it("blocks destructive file sanitation when signed provenance is present", () => {
    expect(() => planSanitizationJob({ kind: "jpeg", intent: "sanitize", bytes: 100, hasProvenance: true })).toThrow(/provenance/i);
  });
});
