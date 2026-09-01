import { buildTransformMetrics } from "./metrics";
import { extractInvariantValues, restoreProtectedText, tokenOccurrenceCount } from "./protect";
import type { PreparedText, TransformMode, TransformValidation } from "./types";

const LENGTH_BOUNDS: Record<TransformMode, [number, number]> = {
  natural: [0.75, 1.25],
  clarity: [0.7, 1.3],
  concise: [0.45, 1.02],
  formal: [0.75, 1.3],
};

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function validateTransformedDraft(prepared: PreparedText, protectedDraft: string, mode: TransformMode): TransformValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let protectedPreserved = 0;

  for (const span of prepared.spans) {
    const count = tokenOccurrenceCount(protectedDraft, span.token);
    if (count === 1) protectedPreserved += 1;
    else errors.push(`${span.kind} placeholder ${span.token} occurred ${count} times; expected exactly once.`);
  }

  const restoredText = errors.length ? null : restoreProtectedText(protectedDraft.trim(), prepared.spans);
  const outputForMetrics = restoredText ?? protectedDraft;
  const metrics = buildTransformMetrics(prepared.original, outputForMetrics, prepared.spans.length, protectedPreserved);

  if (restoredText) {
    const sourceInvariants = extractInvariantValues(prepared.original);
    const outputInvariants = extractInvariantValues(restoredText);
    if (!arraysEqual(sourceInvariants, outputInvariants)) {
      errors.push("A protected factual invariant was added, removed, or changed.");
    }
  }

  const [minimum, maximum] = LENGTH_BOUNDS[mode];
  if (metrics.lengthRatio < minimum || metrics.lengthRatio > maximum) {
    errors.push(`Length ratio ${metrics.lengthRatio.toFixed(2)} is outside the ${minimum.toFixed(2)}–${maximum.toFixed(2)} range for ${mode} mode.`);
  }

  if (restoredText?.trim() === prepared.original.trim()) {
    warnings.push("The output is effectively unchanged from the source.");
  }
  if (metrics.longestSharedWordRun > 30) {
    warnings.push("A long source phrase remains unchanged; review whether the edit was meaningful enough for your purpose.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    restoredText,
    metrics,
  };
}
