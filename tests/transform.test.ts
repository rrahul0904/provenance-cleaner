import { describe, expect, it } from "vitest";
import {
  chunkProtectedText,
  prepareProtectedText,
  restoreProtectedText,
  validateTransformedDraft,
  longestSharedWordRun,
  trigramOverlap,
} from "../src/lib/transform";

describe("semantic transformation guardrails", () => {
  it("protects factual and verbatim spans before generation", () => {
    const source = "On August 31, 2026, see https://example.com/report and email data@example.com. Revenue was $12.5 million [4]. \"Keep this quote unchanged.\"";
    const prepared = prepareProtectedText(source);

    expect(prepared.spans.some((span) => span.kind === "date")).toBe(true);
    expect(prepared.spans.some((span) => span.kind === "url")).toBe(true);
    expect(prepared.spans.some((span) => span.kind === "email")).toBe(true);
    expect(prepared.spans.some((span) => span.kind === "number")).toBe(true);
    expect(prepared.spans.some((span) => span.kind === "citation")).toBe(true);
    expect(prepared.spans.some((span) => span.kind === "quote")).toBe(true);
    expect(restoreProtectedText(prepared.protectedText, prepared.spans)).toBe(source);
  });

  it("rejects a draft that drops a protected span", () => {
    const prepared = prepareProtectedText("The result was 42 on 2026-08-31.");
    const missingOneToken = prepared.protectedText.replace(prepared.spans[0].token, "");
    const result = validateTransformedDraft(prepared, missingOneToken, "natural");

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("expected exactly once"))).toBe(true);
  });

  it("rejects newly introduced factual numbers", () => {
    const prepared = prepareProtectedText("The cohort included 42 participants and recruitment closed on 2026-08-31.");
    const draft = `The cohort had ${prepared.spans[0].token} participants, and recruitment ended on ${prepared.spans[1].token}; 99 sites contributed.`;
    const result = validateTransformedDraft(prepared, draft, "natural");

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("A protected factual invariant was added, removed, or changed.");
  });

  it("accepts a meaning-preserving draft with every invariant intact", () => {
    const prepared = prepareProtectedText("We launched on 2026-08-31 at https://example.com with 42 users.");
    const date = prepared.spans.find((span) => span.kind === "date")!;
    const url = prepared.spans.find((span) => span.kind === "url")!;
    const number = prepared.spans.find((span) => span.kind === "number")!;
    const draft = `We released the service on ${date.token} through ${url.token} with ${number.token} users.`;
    const result = validateTransformedDraft(prepared, draft, "natural");

    expect(result.ok).toBe(true);
    expect(result.restoredText).toContain("2026-08-31");
    expect(result.metrics.protectedPreserved).toBe(result.metrics.protectedTotal);
  });

  it("reports phrase overlap without using it as a pass/fail target", () => {
    const source = "The quick brown fox jumps over the lazy dog near the river bank.";
    const output = "Near the river bank, a quick brown fox leaps over a lazy dog.";
    expect(longestSharedWordRun(source, output)).toBeGreaterThan(1);
    expect(trigramOverlap(source, output)).toBeGreaterThanOrEqual(0);
    expect(trigramOverlap(source, output)).toBeLessThanOrEqual(1);
  });

  it("chunks long text without changing total content order", () => {
    const source = Array.from({ length: 80 }, (_, index) => `Paragraph ${index} contains enough ordinary prose to exercise the planner.`).join("\n\n");
    const chunks = chunkProtectedText(source, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n")).toBe(source);
  });
});
