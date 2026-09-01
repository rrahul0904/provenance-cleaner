import type { TransformMode } from "./types";

const MODE_GUIDANCE: Record<TransformMode, string> = {
  parity: "Rewrite the unprotected prose substantially while preserving the same meaning and approximately the same length. Avoid carrying over runs of four or more consecutive source words outside immutable protected spans.",
  natural: "Improve flow, rhythm, and readability while preserving the writer's apparent voice and all substantive meaning.",
  clarity: "Make the prose clearer and better structured. Resolve awkward wording without adding explanations or new claims.",
  concise: "Reduce repetition and unnecessary wording while preserving every factual claim, qualification, and important nuance.",
  formal: "Make the prose professional, precise, and polished without making it more ornate or changing its meaning.",
};

export const TRANSFORM_SYSTEM = `You are a careful prose editing engine.

Rules:
- Edit only for the requested style goal.
- Preserve meaning, factual claims, uncertainty, qualifications, and point of view.
- Never invent examples, names, dates, numbers, sources, conclusions, or supporting facts.
- Tokens shaped like [[PROTECTED_0000]] are immutable. Keep every such token exactly once and byte-for-byte unchanged.
- Do not add headings, notes, commentary, explanations, or quotation marks around the response unless they are already part of the source.
- Return only the revised prose.`;

export function transformPrompt(text: string, mode: TransformMode, retryFeedback?: string) {
  return `${MODE_GUIDANCE[mode]}\n\n${retryFeedback ? `The previous attempt failed validation. Correct these issues without weakening any rule:\n${retryFeedback}\n\n` : ""}SOURCE:\n${text}`;
}
