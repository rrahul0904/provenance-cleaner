export const MAX_REWRITE_WORDS = 8_000;
export const MAX_FILE_BYTES = Math.floor(3.2 * 1024 * 1024);
export const GUEST_PROMO_CREDITS = 2;
export const SIGNUP_PROMO_CREDITS = 3;
export const GUEST_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type BillableInputKind = "text" | "txt" | "docx" | "png" | "jpeg";

export function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).filter(Boolean).length : 0;
}

export function creditCostForWords(words: number) {
  if (!Number.isFinite(words) || words < 0) throw new Error("Word count must be a non-negative finite number.");
  return Math.max(1, Math.ceil(words / 1_000));
}

export function creditCostForText(text: string) {
  return creditCostForWords(countWords(text));
}

export function creditCostForInput(kind: BillableInputKind, text?: string) {
  if (kind === "text" || kind === "txt") return creditCostForText(text ?? "");
  return 1;
}

export function validateRewriteWordCount(text: string) {
  const words = countWords(text);
  return { words, ok: words <= MAX_REWRITE_WORDS };
}

export function isAcceptedFileKind(name: string, mimeType = "") {
  const lower = name.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (lower.endsWith(".docx")) return "docx" as const;
  if (lower.endsWith(".png") || mime === "image/png") return "png" as const;
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || mime === "image/jpeg") return "jpeg" as const;
  if (lower.endsWith(".txt") || mime === "text/plain") return "txt" as const;
  return null;
}

export function validateFileSize(bytes: number) {
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= MAX_FILE_BYTES;
}
