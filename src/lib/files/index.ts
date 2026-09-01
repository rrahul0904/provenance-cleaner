import { ascii } from "./binary";
import { inspectDocx, sanitizeDocx } from "./docx";
import { inspectJpeg, inspectPng, inspectWebp } from "./image";
import { inspectPdf } from "./pdf";
import type { FileFinding, FileInspectionReceipt, FileSanitizeResult, SupportedFileFormat } from "./types";

const MIME: Record<SupportedFileFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export function detectFileFormat(bytes: Uint8Array, name = ""): SupportedFileFormat {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 137 && ascii(bytes, 1, 4) === "PNG") return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && /\.docx$/i.test(name)) return "docx";
  throw new Error("Unsupported file type. Use JPEG, PNG, WebP, DOCX, or PDF.");
}

function summarize(findings: FileFinding[]) {
  return {
    total: findings.length,
    privacyMetadata: findings.filter((item) => item.disposition === "privacy_metadata").length,
    provenance: findings.filter((item) => item.disposition === "provenance").length,
    reviewRequired: findings.filter((item) => item.disposition === "review").length,
    removableByDefault: findings.filter((item) => item.removableByDefault).length,
  };
}

export function inspectFile(bytes: Uint8Array, name: string, scannedAt = new Date().toISOString()): FileInspectionReceipt {
  const format = detectFileFormat(bytes, name);
  let findings: FileFinding[];
  if (format === "jpeg") findings = inspectJpeg(bytes).findings;
  else if (format === "png") findings = inspectPng(bytes).findings;
  else if (format === "webp") findings = inspectWebp(bytes).findings;
  else if (format === "docx") findings = inspectDocx(bytes);
  else findings = inspectPdf(bytes);

  const summary = summarize(findings);
  const hasProvenance = summary.provenance > 0;

  return {
    version: "file-scan-v1",
    scannedAt,
    file: { name, format, mimeType: MIME[format], bytes: bytes.length },
    findings,
    summary,
    capabilities: {
      inspect: true,
      sanitize: format !== "pdf" && !hasProvenance,
      provenanceRemoval: false,
    },
  };
}

function sanitizedName(name: string) {
  const index = name.lastIndexOf(".");
  return index > 0 ? `${name.slice(0, index)}.clean${name.slice(index)}` : `${name}.clean`;
}

export function sanitizeFile(bytes: Uint8Array, name: string): FileSanitizeResult {
  const before = inspectFile(bytes, name);
  const format = before.file.format;
  if (format === "pdf") throw new Error("PDF sanitization is intentionally disabled in Phase 1; inspection is available.");
  if (before.summary.provenance > 0) {
    throw new Error("Sanitization is blocked because provenance metadata may be cryptographically bound to the original asset bytes. Verify Content Credentials before editing the file.");
  }

  let output: Uint8Array;
  if (format === "jpeg") output = inspectJpeg(bytes).sanitize();
  else if (format === "png") output = inspectPng(bytes).sanitize();
  else if (format === "webp") output = inspectWebp(bytes).sanitize();
  else output = sanitizeDocx(bytes);

  const after = inspectFile(output, sanitizedName(name));
  const removedIds = new Set(before.findings.filter((item) => item.removableByDefault).map((item) => item.id));
  return {
    version: "file-sanitize-v1",
    output,
    outputFileName: sanitizedName(name),
    mimeType: before.file.mimeType,
    removed: before.findings.filter((item) => removedIds.has(item.id)),
    preserved: before.findings.filter((item) => !item.removableByDefault),
    before,
    after,
  };
}

export * from "./types";
