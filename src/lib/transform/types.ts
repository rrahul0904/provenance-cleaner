import type { WatermarkVerificationResult } from "./watermark";

export const TRANSFORM_MODES = ["parity", "natural", "clarity", "concise", "formal"] as const;
export type TransformMode = (typeof TRANSFORM_MODES)[number];
export type ProtectedKind = "url" | "email" | "date" | "number" | "citation" | "quote" | "code" | "entity";
export interface ProtectedSpan { id: number; kind: ProtectedKind; token: string; value: string; start: number; end: number; }
export interface PreparedText { original: string; protectedText: string; spans: ProtectedSpan[]; }
export interface TransformChecks {
  protectedSpansPreserved: boolean;
  numericDateEntityExpected: number;
  numericDateEntityPreserved: number;
  quoteReferenceExpected: number;
  quoteReferencePreserved: number;
}
export interface TransformMetrics {
  sourceWords: number;
  outputWords: number;
  lengthRatio: number;
  retainedPercent: number;
  wordingReplacedPercent: number;
  protectedTotal: number;
  protectedPreserved: number;
  longestSharedWordRun: number;
  trigramOverlap: number;
  unprotectedLongestSharedWordRun: number;
}
export interface TransformValidation { ok: boolean; errors: string[]; warnings: string[]; restoredText: string | null; metrics: TransformMetrics; checks: TransformChecks; }
export interface TransformBillingReceipt { operationId: string; reservationId: string; creditsCharged: number; balanceAfter: number; }
export interface TransformReceipt {
  sourceWords: number;
  outputWords: number;
  retainedPercent: number;
  wordingReplacedPercent: number;
  longestUnprotectedSharedWordRun: number;
  protectedSpanCount: number;
  checks: TransformChecks;
  model: string;
  attempts: number;
  creditsCharged: number;
}
export interface TransformResult {
  version: "semantic-transform-v1" | "semantic-transform-v2";
  text: string;
  mode: TransformMode;
  model: string;
  attempts: number;
  metrics: TransformMetrics;
  receipt: TransformReceipt;
  watermark: WatermarkVerificationResult;
  warnings: string[];
  billing?: TransformBillingReceipt;
}
