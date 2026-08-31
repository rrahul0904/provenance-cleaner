export type FindingCategory =
  | "zero_width"
  | "bidi_control"
  | "unicode_tag"
  | "unusual_space"
  | "format_control";

export type FindingDisposition = "safe_remove" | "review";

export interface TextFinding {
  id: string;
  category: FindingCategory;
  disposition: FindingDisposition;
  index: number;
  codePoint: string;
  characterName: string;
  description: string;
}

export interface TextScanReceipt {
  version: "text-scan-v1";
  scannedAt: string;
  input: {
    characters: number;
    codePoints: number;
    words: number;
  };
  findings: TextFinding[];
  summary: {
    total: number;
    safeToRemove: number;
    reviewRequired: number;
    byCategory: Record<FindingCategory, number>;
  };
}

export interface SanitizeReceipt {
  mode: "conservative" | "aggressive";
  removed: TextFinding[];
  preservedForReview: TextFinding[];
  output: string;
}
