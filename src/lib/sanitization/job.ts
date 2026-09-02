import { creditCostForInput, MAX_FILE_BYTES, MAX_REWRITE_WORDS, validateFileSize, validateRewriteWordCount } from "@/lib/product-contract";
import type { BillableInputKind } from "@/lib/product-contract";

export type SanitizationIntent = "inspect" | "sanitize" | "rewrite";
export type SanitizationStage = "inspect" | "plan" | "reserve" | "sanitize" | "rewrite" | "validate" | "commit" | "receipt";

export type SanitizationJobPlan = {
  kind: BillableInputKind;
  intent: SanitizationIntent;
  stages: SanitizationStage[];
  credits: number;
  localInspection: true;
  serverAuthoritativeBilling: boolean;
  ephemeralContentProcessing: boolean;
  rewriteAllowed: boolean;
};

export class SanitizationContractError extends Error {
  constructor(public readonly code: "file_too_large" | "rewrite_too_large" | "rewrite_unsupported" | "provenance_blocked" | "missing_input", message: string) {
    super(message);
    this.name = "SanitizationContractError";
  }
}

export function planSanitizationJob(input: {
  kind: BillableInputKind;
  intent: SanitizationIntent;
  text?: string;
  bytes?: number;
  hasProvenance?: boolean;
}): SanitizationJobPlan {
  const isText = input.kind === "text" || input.kind === "txt";
  const isFile = !isText;

  if (isText && input.text === undefined) throw new SanitizationContractError("missing_input", "Text input is required.");
  if (isFile && input.bytes === undefined) throw new SanitizationContractError("missing_input", "File size is required.");
  if (isFile && !validateFileSize(input.bytes!)) throw new SanitizationContractError("file_too_large", `DOCX, PNG and JPEG jobs are limited to ${MAX_FILE_BYTES} bytes.`);
  if (input.intent === "rewrite" && !isText) throw new SanitizationContractError("rewrite_unsupported", "Semantic rewriting is available only for pasted text and TXT input.");
  if (input.intent === "rewrite" && !validateRewriteWordCount(input.text ?? "").ok) throw new SanitizationContractError("rewrite_too_large", `Semantic editing accepts at most ${MAX_REWRITE_WORDS.toLocaleString("en-US")} words per operation.`);
  if (input.intent === "sanitize" && isFile && input.hasProvenance) throw new SanitizationContractError("provenance_blocked", "Signed provenance must not be silently invalidated by sanitation.");

  if (input.intent === "inspect") {
    return { kind: input.kind, intent: input.intent, stages: ["inspect", "receipt"], credits: 0, localInspection: true, serverAuthoritativeBilling: false, ephemeralContentProcessing: false, rewriteAllowed: isText };
  }

  const credits = creditCostForInput(input.kind, input.text);
  const workStage: SanitizationStage = input.intent === "rewrite" ? "rewrite" : "sanitize";
  return {
    kind: input.kind,
    intent: input.intent,
    stages: ["inspect", "plan", "reserve", workStage, "validate", "commit", "receipt"],
    credits,
    localInspection: true,
    serverAuthoritativeBilling: true,
    ephemeralContentProcessing: true,
    rewriteAllowed: isText,
  };
}
