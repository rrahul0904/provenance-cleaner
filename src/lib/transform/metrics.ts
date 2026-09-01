import type { TransformMetrics } from "./types";

export function words(text: string) {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

export function longestSharedWordRun(source: string, output: string) {
  const a = words(source);
  const b = words(output);
  if (!a.length || !b.length) return 0;

  let previous = new Uint32Array(b.length + 1);
  let longest = 0;
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Uint32Array(b.length + 1);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        longest = Math.max(longest, current[j]);
      }
    }
    previous = current;
  }
  return longest;
}

function ngrams(tokens: string[], size: number) {
  const set = new Set<string>();
  for (let i = 0; i <= tokens.length - size; i += 1) set.add(tokens.slice(i, i + size).join(" "));
  return set;
}

export function trigramOverlap(source: string, output: string) {
  const sourceSet = ngrams(words(source), 3);
  const outputSet = ngrams(words(output), 3);
  if (!sourceSet.size && !outputSet.size) return 1;
  if (!sourceSet.size || !outputSet.size) return 0;

  let intersection = 0;
  for (const gram of sourceSet) if (outputSet.has(gram)) intersection += 1;
  const union = sourceSet.size + outputSet.size - intersection;
  return union ? intersection / union : 0;
}

export function buildTransformMetrics(source: string, output: string, protectedTotal: number, protectedPreserved: number): TransformMetrics {
  const sourceWords = words(source).length;
  const outputWords = words(output).length;
  return {
    sourceWords,
    outputWords,
    lengthRatio: sourceWords ? outputWords / sourceWords : 1,
    protectedTotal,
    protectedPreserved,
    longestSharedWordRun: longestSharedWordRun(source, output),
    trigramOverlap: trigramOverlap(source, output),
  };
}
