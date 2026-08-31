import type { C2paVerificationReceipt } from "@/lib/c2pa/types";
import type { FileInspectionReceipt, FileSanitizeResult } from "./types";

export interface ExportableFileVerificationReceipt {
  version: "file-verification-v2";
  generatedAt: string;
  original: {
    sha256: string;
    inspection: FileInspectionReceipt;
    c2pa?: C2paVerificationReceipt;
  };
  sanitized?: {
    sha256: string;
    inspection: FileInspectionReceipt;
    removedFindingIds: string[];
  };
  policy: {
    rawContentStored: false;
    provenanceRemoval: false;
    provenanceBearingAssetsModifiedByDefault: false;
  };
}

export function buildVerificationReceipt(input: {
  originalHash: string;
  inspection: FileInspectionReceipt;
  c2pa?: C2paVerificationReceipt | null;
  cleaned?: FileSanitizeResult | null;
  cleanedHash?: string | null;
}): ExportableFileVerificationReceipt {
  const receipt: ExportableFileVerificationReceipt = {
    version: "file-verification-v2",
    generatedAt: new Date().toISOString(),
    original: {
      sha256: input.originalHash,
      inspection: input.inspection,
      ...(input.c2pa ? { c2pa: input.c2pa } : {}),
    },
    policy: {
      rawContentStored: false,
      provenanceRemoval: false,
      provenanceBearingAssetsModifiedByDefault: false,
    },
  };

  if (input.cleaned && input.cleanedHash) {
    receipt.sanitized = {
      sha256: input.cleanedHash,
      inspection: input.cleaned.after,
      removedFindingIds: input.cleaned.removed.map((item) => item.id),
    };
  }

  return receipt;
}
