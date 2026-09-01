export const TRANSFORM_MODES = ["natural", "clarity", "concise", "formal"] as const;

export type TransformMode = (typeof TRANSFORM_MODES)[number];

export type ProtectedKind = "url" | "email" | "date" | "number" | "citation" | "quote" | "code";

export interface ProtectedSpan {
  id: number;
  kind: ProtectedKind;
  token: string;
  value: string;
  start: number;
  end: number;
}

export interface PreparedText {
  original: string;
  protectedText: string;
  spans: ProtectedSpan[];
}

export interface TransformMetrics {
  sourceWords: number;
  outputWords: number;
  lengthRatio: number;
  protectedTotal: number;
  protectedPreserved: number;
  longestSharedWordRun: number;
  trigramOverlap: number;
}

export interface TransformValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  restoredText: string | null;
  metrics: TransformMetrics;
}

export interface TransformResult {
  version: "semantic-transform-v1";
  text: string;
  mode: TransformMode;
  model: string;
  attempts: number;
  metrics: TransformMetrics;
  warnings: string[];
}
