import { describe, expect, it } from "vitest";
import { calibrateWriterStyle, compareStyleBalance, createSyntheticStyleProfile, measureStyleBalance, normalizeStyleText, STYLE_METRICS, verifyStyleReceipt, type StyleProfile } from "../src/lib/style-balance-meter";
import { STYLE_REFERENCE_SAMPLES } from "../src/lib/style-balance-reference";

const context = { userId: "writer-one", sessionId: "operation-one", now: 1_000 };
const sample = STYLE_REFERENCE_SAMPLES[0];
// Distinct synthetic sentence lengths place observations on both sides of the independently calibrated sample.
const brief = Array.from({ length: 18 }, () => "quiet gardens invite patient walks.").join(" ");
const long = Array.from({ length: 4 }, () => "quiet gardens invite patient walks while winding paths lead past broad windows and shaded benches where visitors pause to watch the slowly changing light across the river beside the workshop.").join(" ");

describe("independent StyleBalanceMeter", () => {
  it("normalizes deterministically without changing the original receipt hashes", async () => {
    expect(normalizeStyleText("  cafe\u0301\t \r\n path  ")).toBe("café\npath");
    const profile = await createSyntheticStyleProfile();
    expect(await measureStyleBalance(sample.replaceAll("\n", "\r\n"), profile)).toEqual(await measureStyleBalance(sample, profile));
    const a = await compareStyleBalance(sample, sample, profile);
    const b = await compareStyleBalance(sample.replaceAll("\n", "\r\n"), sample.replaceAll("\n", "\r\n"), profile);
    expect(a.receipt.beforeHash).not.toBe(b.receipt.beforeHash);
    expect(a.receipt.beforeNormalizedHash).toBe(b.receipt.beforeNormalizedHash);
  });
  it("rejects malformed Unicode and oversized input", async () => {
    await expect(measureStyleBalance("\ud800")).rejects.toThrow("Invalid");
    await expect(measureStyleBalance("a".repeat(250_001))).rejects.toThrow("oversized");
  });
  it.each(["", "A short note.", "word ".repeat(60)])("fails closed for insufficient input", async text => {
    const result = await measureStyleBalance(text, await createSyntheticStyleProfile());
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    for (const metric of Object.values(result.metrics)) { expect(metric.value).toBeNull(); expect(metric.state).toBe("INSUFFICIENT_EVIDENCE"); }
  });
  it("fails closed when calibration/reference evidence is absent", async () => {
    const result = await measureStyleBalance(sample);
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE"); expect(result.reason).toContain("absent");
    await expect(calibrateWriterStyle("Short.", context)).rejects.toThrow("insufficient");
  });
  it("reproduces identical profiles, measurements and receipts", async () => {
    const a = await createSyntheticStyleProfile(), b = await createSyntheticStyleProfile();
    expect(a).toEqual(b);
    expect(await measureStyleBalance(sample, a)).toEqual(await measureStyleBalance(sample, b));
    expect(await compareStyleBalance(sample, sample, a)).toEqual(await compareStyleBalance(sample, sample, b));
  });
  it("describes below, within and above independently of authorship", async () => {
    const p = await calibrateWriterStyle(brief, context);
    expect((await measureStyleBalance(brief, p, context)).metrics.sentenceWords.state).toBe("WITHIN_RANGE");
    expect((await measureStyleBalance(long, p, context)).metrics.sentenceWords.state).toBe("ABOVE_RANGE");
    const other = await calibrateWriterStyle(long, context);
    expect((await measureStyleBalance(brief, other, context)).metrics.sentenceWords.state).toBe("BELOW_RANGE");
    expect(JSON.stringify(await measureStyleBalance(brief, other, context))).not.toMatch(/human|AI|detector/);
  });
  it("detects both directions of band crossing and distinguishes short-text absence", async () => {
    const middle = Array.from({ length: 8 }, () => "quiet gardens invite patient walks beside wide paths through sheltered trees.").join(" ");
    const profile = await calibrateWriterStyle(middle, context);
    expect((await compareStyleBalance(long, brief, profile, context)).overshoot).toContain("sentenceWords");
    expect((await compareStyleBalance(brief, long, profile, context)).overshoot).toContain("sentenceWords");
    expect((await compareStyleBalance(brief, "quiet paths.", profile, context)).overshoot).toEqual([]);
  });
  it("keeps writer profiles isolated by owner AND operation", async () => {
    const p = await calibrateWriterStyle(sample, context);
    await expect(measureStyleBalance(sample, p, { ...context, userId: "writer-two" })).rejects.toThrow("scope");
    await expect(measureStyleBalance(sample, p, { ...context, sessionId: "operation-two" })).rejects.toThrow("scope");
    await expect(measureStyleBalance(sample, p)).rejects.toThrow("scope");
    expect(await createSyntheticStyleProfile()).not.toHaveProperty("scopeHash");
  });
  it("rejects stale, future, unbounded or missing writer calibration", async () => {
    const p = await calibrateWriterStyle(sample, context);
    await expect(measureStyleBalance(sample, p, { ...context, now: p.expiresAt! })).rejects.toThrow("stale");
    await expect(compareStyleBalance(sample, sample, p, { ...context, now: p.expiresAt! })).rejects.toThrow("stale");
    await expect(measureStyleBalance(sample, p, { ...context, now: 0 })).rejects.toThrow("stale");
    await expect(measureStyleBalance(sample, { ...p, expiresAt: 999_999_999 }, context)).rejects.toThrow("Malformed");
    await expect(measureStyleBalance(sample, { ...p, sampleHashes: ["0".repeat(64)] }, context)).rejects.toThrow("Malformed");
    await expect(calibrateWriterStyle(sample, { ...context, userId: "" })).rejects.toThrow("scope");
  });
  it.each([null, {}, { version: "99" }, { bands: {} }])("rejects malformed comparison profiles", async p => {
    await expect(compareStyleBalance(sample, sample, p)).rejects.toThrow("Malformed");
  });
  it("rejects unsupported meter, normalization and profile versions", async () => {
    const p = await createSyntheticStyleProfile();
    for (const key of ["version", "meterVersion", "normalizationVersion"])
      await expect(measureStyleBalance(sample, { ...p, [key]: "future-version" })).rejects.toThrow("unsupported");
  });
  it("rejects invalid bounds, non-finite values, missing metrics and forged references", async () => {
    const p = await createSyntheticStyleProfile();
    for (const band of [{ low: -1, median: 0, high: 1 }, { low: 3, median: 2, high: 1 }, { low: 0, median: NaN, high: 1 }, { low: 0, median: 1, high: Infinity }, { low: 0, median: 2, high: 3 }]) {
      await expect(measureStyleBalance(sample, { ...p, bands: { ...p.bands, firstPersonRate: band } })).rejects.toThrow();
    }
    const missing = structuredClone(p) as StyleProfile;
    delete (missing.bands as Partial<StyleProfile["bands"]>).sentenceWords;
    await expect(measureStyleBalance(sample, missing)).rejects.toThrow();
    await expect(measureStyleBalance(sample, { ...p, sampleHashes: p.sampleHashes.map(() => "0".repeat(64)) })).rejects.toThrow("mismatch");
    await expect(measureStyleBalance(sample, { ...p, bands: { ...p.bands, sentenceWords: { low: 0, median: 1, high: 2 } } })).rejects.toThrow("mismatch");
  });
  it("keeps every measured metric within documented numeric bounds", async () => {
    const p = await createSyntheticStyleProfile();
    for (const text of [sample, brief, long, `${brief} ${"?".repeat(1000)}`]) {
      const m = await measureStyleBalance(text, p);
      for (const key of STYLE_METRICS) { expect(Number.isFinite(m.metrics[key].value)).toBe(true); expect(m.metrics[key].value!).toBeGreaterThanOrEqual(0); }
      expect(m.metrics.questionRate.value!).toBeLessThanOrEqual(1);
      expect(m.metrics.lexicalDiversity.value!).toBeLessThanOrEqual(1);
    }
  });
  it.each([['2026-10-01', '2026-10-02'], ['45', '46'], ['https://example.test/a', 'https://example.test/b'], ['"keep this quote"', '"changed quote"'], ['`safe_code`', '`other_code`'], ['Mira Chen', 'Mira James'], ['[7]', '[8]']])("rejects protected-fact mutations", async (before, after) => {
    const profile = await createSyntheticStyleProfile();
    await expect(compareStyleBalance(`${brief} ${before}`, `${brief} ${after}`, profile)).rejects.toThrow("Protected facts");
  });
  it("verifies full receipt hashes and rejects altered text, metadata and measurements", async () => {
    const p = await createSyntheticStyleProfile(), result = await compareStyleBalance(brief, long, p);
    expect(result.receipt.beforeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.receipt.profileId).toBe(p.id);
    expect(await verifyStyleReceipt(result, brief, long, p)).toBe(true);
    expect(await verifyStyleReceipt(result, `${brief} changed`, long, p)).toBe(false);
    const hashChange = structuredClone(result); hashChange.receipt.afterHash = "0".repeat(64);
    expect(await verifyStyleReceipt(hashChange, brief, long, p)).toBe(false);
    const measurementChange = structuredClone(result); measurementChange.after.metrics.sentenceWords.value = 1;
    expect(await verifyStyleReceipt(measurementChange, brief, long, p)).toBe(false);
    const metadataChange = structuredClone(result); Object.assign(metadataChange, { profileVersion: "2" });
    expect(await verifyStyleReceipt(metadataChange, brief, long, p)).toBe(false);
  });
  it("embeds a private, non-raw writer profile that independently verifies after export", async () => {
    const writerProfile = await calibrateWriterStyle(sample, context);
    const result = await compareStyleBalance(brief, long, writerProfile, context);
    const exported = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(exported.receipt.profile).toEqual(writerProfile);
    expect(exported.receipt.profile.sampleHashes).toEqual([]);
    expect(JSON.stringify(exported)).not.toContain(sample);
    expect(await verifyStyleReceipt(exported, brief, long)).toBe(true);
    const changedProfile = structuredClone(exported);
    changedProfile.receipt.profile.bands.sentenceWords.median += 1;
    expect(await verifyStyleReceipt(changedProfile, brief, long)).toBe(false);
    const malformedProfile = structuredClone(exported);
    malformedProfile.receipt.profile.scopeHash = "invalid";
    expect(await verifyStyleReceipt(malformedProfile, brief, long)).toBe(false);
  });
});
