import { z } from "zod";
import { sha256Hex } from "./files/hash";
import { prepareProtectedText } from "./transform/protect";
import { STYLE_REFERENCE_SAMPLES } from "./style-balance-reference";

export const STYLE_METER_VERSION = "style-balance-v1" as const;
export const STYLE_NORMALIZATION_VERSION = "nfc-lines-v1" as const;
export const STYLE_MIN_WORDS = 48;
export const STYLE_MIN_SENTENCES = 4;
const MAX_TEXT = 250_000;
export const STYLE_METRICS = ["sentenceWords", "sentenceVariation", "paragraphWords", "headingDensity", "listDensity", "questionRate", "firstPersonRate", "contractionRate", "commaRate", "semicolonRate", "parenthesisRate", "dashRate", "lexicalDiversity"] as const;
export type StyleMetric = typeof STYLE_METRICS[number];
export type StyleState = "BELOW_RANGE" | "WITHIN_RANGE" | "ABOVE_RANGE" | "INSUFFICIENT_EVIDENCE";
const metricMaximum = (key: StyleMetric) => key === "sentenceWords" || key === "paragraphWords" ? MAX_TEXT : key === "sentenceVariation" ? Math.sqrt(MAX_TEXT) : key.endsWith("Rate") && !["questionRate", "firstPersonRate", "contractionRate"].includes(key) ? MAX_TEXT : 1;
const finite = z.number().finite().nonnegative();
const bandSchema = z.object({ low: finite, median: finite, high: finite }).strict().refine(v => v.low <= v.median && v.median <= v.high);
const bandsSchema = z.object(Object.fromEntries(STYLE_METRICS.map(key => [key, bandSchema.refine(b => b.high <= metricMaximum(key))])) as Record<StyleMetric, typeof bandSchema>).strict();
const profileSchema = z.object({
  id: z.enum(["synthetic-prose-v1", "writer-sample-v1"]),
  version: z.literal("1"), meterVersion: z.literal(STYLE_METER_VERSION), normalizationVersion: z.literal(STYLE_NORMALIZATION_VERSION),
  source: z.literal("independently-authored-synthetic-cc0-v1").or(z.literal("user-provided-ephemeral-v1")),
  sampleHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(16),
  bands: bandsSchema,
  scopeHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  createdAt: z.number().int().nonnegative().optional(), expiresAt: z.number().int().nonnegative().optional(),
}).strict().superRefine((p, c) => {
  if (p.id === "writer-sample-v1") {
    if (p.source !== "user-provided-ephemeral-v1" || p.sampleHashes.length !== 0 || !p.scopeHash || p.createdAt === undefined || p.expiresAt === undefined || p.expiresAt <= p.createdAt || p.expiresAt - p.createdAt > 3_600_000) c.addIssue({ code: "custom", message: "Writer profile requires bounded lifetime and request scope without retaining a sample digest." });
  } else if (p.source !== "independently-authored-synthetic-cc0-v1" || p.sampleHashes.length !== STYLE_REFERENCE_SAMPLES.length || p.scopeHash || p.createdAt !== undefined || p.expiresAt !== undefined) c.addIssue({ code: "custom", message: "Synthetic reference metadata is invalid." });
});
export type StyleProfile = z.infer<typeof profileSchema>;
export interface StyleContext { userId: string; sessionId: string; now: number; }
export interface StyleMeasurement {
  meterVersion: typeof STYLE_METER_VERSION; normalizationVersion: typeof STYLE_NORMALIZATION_VERSION;
  words: number; sentences: number; paragraphs: number;
  status: "MEASURED" | "INSUFFICIENT_EVIDENCE";
  reason: string | null;
  metrics: Record<StyleMetric, { value: number | null; band: { low: number; median: number; high: number } | null; state: StyleState }>;
}
export class StyleBalanceError extends Error {}
const digest = (text: string) => sha256Hex(new TextEncoder().encode(text));
export function normalizeStyleText(text: string) {
  if (typeof text !== "string" || text.length > MAX_TEXT || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) throw new StyleBalanceError("Invalid or oversized style input.");
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\t \u00a0]+/g, " ").split("\n").map(line => line.trim()).join("\n").trim();
}
function tokens(text: string) { return text.toLowerCase().match(/\p{L}[\p{L}\p{M}]*(?:['’][\p{L}\p{M}]+)*|\p{N}+/gu) ?? []; }
function rawMeasurement(text: string) {
  const normalized = normalizeStyleText(text);
  const words = tokens(normalized);
  const sentenceWords = normalized.split(/[.!?]+(?:["'”’)]*)\s*|\n+/u).map(part => tokens(part).length).filter(Boolean);
  const paragraphs = normalized.split(/\n\s*\n/u).filter(part => tokens(part).length);
  const lines = normalized.split("\n").filter(Boolean);
  const mean = sentenceWords.reduce((sum, n) => sum + n, 0) / (sentenceWords.length || 1);
  const count = (regex: RegExp) => (normalized.match(regex) ?? []).length;
  const values: Record<StyleMetric, number> = {
    sentenceWords: mean,
    sentenceVariation: Math.sqrt(sentenceWords.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (sentenceWords.length || 1)) / (mean || 1),
    paragraphWords: words.length / (paragraphs.length || 1),
    headingDensity: lines.filter(line => /^#{1,6} /u.test(line)).length / (lines.length || 1),
    listDensity: lines.filter(line => /^(?:[-*+] |\d+[.)] )/u.test(line)).length / (lines.length || 1),
    questionRate: Math.min(count(/\?/g), sentenceWords.length) / (sentenceWords.length || 1),
    firstPersonRate: words.filter(word => ["i", "me", "my", "mine", "we", "us", "our", "ours"].includes(word)).length / (words.length || 1),
    contractionRate: words.filter(word => /['’]/u.test(word)).length / (words.length || 1),
    commaRate: count(/,/g) / (words.length || 1), semicolonRate: count(/;/g) / (words.length || 1),
    parenthesisRate: count(/[()]/g) / (words.length || 1), dashRate: count(/[–—]/g) / (words.length || 1),
    // Mean type/token ratio over consecutive blocks of 24 tokens, including the final block.
    lexicalDiversity: Array.from({ length: Math.ceil(words.length / 24) }, (_, i) => { const block = words.slice(i * 24, (i + 1) * 24); return new Set(block).size / block.length; }).reduce((sum, n) => sum + n, 0) / (Math.ceil(words.length / 24) || 1),
  };
  if (STYLE_METRICS.some(key => !Number.isFinite(values[key]) || values[key] < 0 || values[key] > metricMaximum(key))) throw new StyleBalanceError("Out-of-bounds style metrics.");
  return { words: words.length, sentences: sentenceWords.length, paragraphs: paragraphs.length, values };
}
function sufficient(raw: ReturnType<typeof rawMeasurement>) { return raw.words >= STYLE_MIN_WORDS && raw.sentences >= STYLE_MIN_SENTENCES; }
async function scopeHash(context: StyleContext) {
  if (!context.userId || !context.sessionId || !Number.isSafeInteger(context.now) || context.now < 0) throw new StyleBalanceError("Writer scope is invalid.");
  return digest(JSON.stringify([context.userId, context.sessionId]));
}
async function validateProfile(input: unknown, context?: StyleContext, allowUnboundWriterForReceiptVerification = false): Promise<StyleProfile> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw new StyleBalanceError("Malformed or unsupported style profile.");
  const p = parsed.data;
  if (p.id === "writer-sample-v1") {
    if (context) {
      if (p.scopeHash !== await scopeHash(context)) throw new StyleBalanceError("Writer profile scope mismatch.");
      if (context.now < p.createdAt! || context.now >= p.expiresAt!) throw new StyleBalanceError("Writer calibration is stale.");
    } else if (!allowUnboundWriterForReceiptVerification) {
      throw new StyleBalanceError("Writer profile scope mismatch.");
    }
  } else {
    // Reject forged bands and missing/replaced reference evidence for the built-in profile.
    const expected = await createSyntheticStyleProfile();
    if (JSON.stringify(p) !== JSON.stringify(expected)) throw new StyleBalanceError("Synthetic reference/profile mismatch.");
  }
  return p;
}
function bandsFrom(raws: ReturnType<typeof rawMeasurement>[]): StyleProfile["bands"] {
  return Object.fromEntries(STYLE_METRICS.map(key => {
    const v = raws.map(raw => raw.values[key]).sort((a, b) => a - b);
    return [key, { low: v[0], median: v[Math.floor(v.length / 2)], high: v[v.length - 1] }];
  })) as StyleProfile["bands"];
}
export async function createSyntheticStyleProfile(): Promise<StyleProfile> {
  const raws = STYLE_REFERENCE_SAMPLES.map(rawMeasurement);
  if (raws.some(raw => !sufficient(raw))) throw new StyleBalanceError("Reference evidence is insufficient.");
  return { id: "synthetic-prose-v1", version: "1", meterVersion: STYLE_METER_VERSION, normalizationVersion: STYLE_NORMALIZATION_VERSION,
    source: "independently-authored-synthetic-cc0-v1", sampleHashes: await Promise.all(STYLE_REFERENCE_SAMPLES.map(sample => digest(sample))), bands: bandsFrom(raws) };
}
function measurementFromRaw(raw: ReturnType<typeof rawMeasurement>, p: StyleProfile | null): StyleMeasurement {
  const reason = !sufficient(raw) ? `At least ${STYLE_MIN_WORDS} words and ${STYLE_MIN_SENTENCES} sentence/line units are required.` : !p ? "Reference/calibration data is absent." : null;
  return { meterVersion: STYLE_METER_VERSION, normalizationVersion: STYLE_NORMALIZATION_VERSION, words: raw.words, sentences: raw.sentences, paragraphs: raw.paragraphs,
    status: reason ? "INSUFFICIENT_EVIDENCE" : "MEASURED", reason,
    metrics: Object.fromEntries(STYLE_METRICS.map(key => {
      const band = p?.bands[key] ?? null, value = reason ? null : Number(raw.values[key].toFixed(8));
      // Compare unrounded values; rounding is display serialization only.
      const state: StyleState = reason ? "INSUFFICIENT_EVIDENCE" : raw.values[key] < band!.low ? "BELOW_RANGE" : raw.values[key] > band!.high ? "ABOVE_RANGE" : "WITHIN_RANGE";
      return [key, { value, band, state }];
    })) as StyleMeasurement["metrics"] };
}
export async function calibrateWriterStyle(sample: string, context: StyleContext): Promise<StyleProfile> {
  const raw = rawMeasurement(sample);
  if (!sufficient(raw)) throw new StyleBalanceError("Writer sample is insufficient.");
  const owner = await scopeHash(context);
  return { id: "writer-sample-v1", version: "1", meterVersion: STYLE_METER_VERSION, normalizationVersion: STYLE_NORMALIZATION_VERSION,
    source: "user-provided-ephemeral-v1", sampleHashes: [], bands: bandsFrom([raw]), scopeHash: owner, createdAt: context.now, expiresAt: context.now + 3_600_000 };
}
export async function measureStyleBalance(text: string, profile?: unknown, context?: StyleContext): Promise<StyleMeasurement> {
  const raw = rawMeasurement(text);
  let p: StyleProfile | null = null;
  if (profile !== undefined && profile !== null) p = await validateProfile(profile, context);
  return measurementFromRaw(raw, p);
}
function protectedFacts(text: string) { return prepareProtectedText(text).spans.map(span => `${span.kind}:${span.value}`).sort(); }
async function compareWithProfile(beforeText: string, afterText: string, profile: unknown, context?: StyleContext, allowUnboundWriterForReceiptVerification = false) {
  const p = await validateProfile(profile, context, allowUnboundWriterForReceiptVerification);
  const sourceFacts = protectedFacts(beforeText);
  if (JSON.stringify(sourceFacts) !== JSON.stringify(protectedFacts(afterText))) throw new StyleBalanceError("Protected facts were mutated.");
  const before = measurementFromRaw(rawMeasurement(beforeText), p), after = measurementFromRaw(rawMeasurement(afterText), p);
  const overshoot = STYLE_METRICS.filter(key => {
    const b = before.metrics[key].state, a = after.metrics[key].state;
    return (b === "ABOVE_RANGE" && a === "BELOW_RANGE") || (b === "BELOW_RANGE" && a === "ABOVE_RANGE");
  });
  const receipt = { version: "style-receipt-v1" as const, meterVersion: STYLE_METER_VERSION, normalizationVersion: STYLE_NORMALIZATION_VERSION,
    profileId: p.id, profileVersion: p.version, profileHash: await digest(JSON.stringify(p)), profile: p,
    beforeHash: await digest(beforeText), afterHash: await digest(afterText), beforeNormalizedHash: await digest(normalizeStyleText(beforeText)), afterNormalizedHash: await digest(normalizeStyleText(afterText)),
    beforeMeasurementHash: await digest(JSON.stringify(before)), afterMeasurementHash: await digest(JSON.stringify(after)), protectedFactsHash: await digest(JSON.stringify(sourceFacts)), protectedFactsPreserved: true as const };
  return { profileId: p.id, profileVersion: p.version, before, after, overshoot, warnings: [p.id === "synthetic-prose-v1" ? "Range uses independently authored synthetic examples; it is not a population writing standard." : "Writer sample is request-scoped and ephemeral; its exact observed values define this comparison.", ...(before.reason || after.reason ? ["Style comparison has insufficient evidence; no range verdict is available for the affected text."] : []), ...(overshoot.length ? ["An edit crossed the reference band; review the listed metrics for overshoot."] : [])], receipt, receiptHash: await digest(JSON.stringify(receipt)) };
}
export async function compareStyleBalance(beforeText: string, afterText: string, profile: unknown, context?: StyleContext) {
  return compareWithProfile(beforeText, afterText, profile, context);
}
export type StyleBalanceComparison = Awaited<ReturnType<typeof compareStyleBalance>>;
/** Recompute a receipt using its embedded aggregate profile; this checks result integrity, not profile ownership. */
export async function verifyStyleReceipt(result: StyleBalanceComparison, before: string, after: string, profile?: unknown, context?: StyleContext) {
  try {
    const receiptProfile = profile ?? result.receipt.profile;
    const parsed = profileSchema.safeParse(receiptProfile);
    const allowUnboundWriter = context === undefined && parsed.success && parsed.data.id === "writer-sample-v1";
    return JSON.stringify(result) === JSON.stringify(await compareWithProfile(before, after, receiptProfile, context, allowUnboundWriter));
  } catch { return false; }
}

/** Native browser/server facade; measurements require explicit reference evidence. */
export const StyleBalanceMeter = Object.freeze({
  version: STYLE_METER_VERSION,
  normalize: normalizeStyleText,
  measure: measureStyleBalance,
  compare: compareStyleBalance,
  syntheticProfile: createSyntheticStyleProfile,
  calibrateWriter: calibrateWriterStyle,
  verifyReceipt: verifyStyleReceipt,
});
