export type SupportedFileFormat = "jpeg" | "png" | "webp" | "docx" | "pdf";

export type FileFindingKind =
  | "exif"
  | "xmp"
  | "iptc"
  | "comment"
  | "text_chunk"
  | "office_core"
  | "office_app"
  | "office_custom"
  | "pdf_info"
  | "pdf_xmp"
  | "provenance_manifest";

export type FileFindingDisposition = "privacy_metadata" | "provenance" | "review";

export interface FileFinding {
  id: string;
  kind: FileFindingKind;
  disposition: FileFindingDisposition;
  label: string;
  description: string;
  removableByDefault: boolean;
  offset?: number;
  size?: number;
}

export interface FileInspectionReceipt {
  version: "file-scan-v1";
  scannedAt: string;
  file: {
    name: string;
    format: SupportedFileFormat;
    mimeType: string;
    bytes: number;
  };
  findings: FileFinding[];
  summary: {
    total: number;
    privacyMetadata: number;
    provenance: number;
    reviewRequired: number;
    removableByDefault: number;
  };
  capabilities: {
    inspect: true;
    sanitize: boolean;
    provenanceRemoval: false;
  };
}

export interface FileSanitizeResult {
  version: "file-sanitize-v1";
  output: Uint8Array;
  outputFileName: string;
  mimeType: string;
  removed: FileFinding[];
  preserved: FileFinding[];
  before: FileInspectionReceipt;
  after: FileInspectionReceipt;
}
