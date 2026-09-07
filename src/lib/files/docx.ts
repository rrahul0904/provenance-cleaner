import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { FileFinding } from "./types";

const CORE_FIELDS = ["dc:creator", "cp:lastModifiedBy", "dc:title", "dc:subject", "cp:keywords", "dc:description", "dcterms:created", "dcterms:modified"];
const APP_FIELDS = ["Application", "AppVersion", "Company", "Manager", "Template"];
const MAX_DOCX_ENTRIES = 2_048;
const MAX_DOCX_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_DOCX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 250;

function unzipDocxSafely(bytes: Uint8Array) {
  let entryCount = 0;
  let totalUncompressed = 0;
  unzipSync(bytes, {
    filter(info) {
      entryCount += 1;
      if (entryCount > MAX_DOCX_ENTRIES) throw new Error("DOCX package contains too many entries.");
      if (info.originalSize > MAX_DOCX_ENTRY_BYTES) throw new Error("DOCX package contains an oversized entry.");
      totalUncompressed += info.originalSize;
      if (totalUncompressed > MAX_DOCX_TOTAL_BYTES) throw new Error("DOCX package expands beyond the safe processing limit.");
      const ratio = info.size === 0 ? (info.originalSize === 0 ? 1 : Number.POSITIVE_INFINITY) : info.originalSize / info.size;
      if (ratio > MAX_DOCX_COMPRESSION_RATIO) throw new Error("DOCX package has a suspicious compression ratio.");
      if (info.name.startsWith("/") || info.name.includes("../") || info.name.includes("..\\")) throw new Error("DOCX package contains an unsafe entry path.");
      return false;
    },
  });
  return unzipSync(bytes);
}

function hasMeaningfulContent(xml: string, tags: string[]) {
  return tags.some((tag) => {
    const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
    return Boolean(match?.[1]?.trim());
  });
}

function blankTags(xml: string, tags: string[]) {
  let result = xml;
  for (const tag of tags) {
    const pattern = new RegExp(`(<${tag}\\b[^>]*>)[\\s\\S]*?(<\\/${tag}>)`, "gi");
    result = result.replace(pattern, "$1$2");
  }
  return result;
}

export function inspectDocx(bytes: Uint8Array): FileFinding[] {
  const zip = unzipDocxSafely(bytes);
  const findings: FileFinding[] = [];
  const core = zip["docProps/core.xml"] ? strFromU8(zip["docProps/core.xml"]) : "";
  const app = zip["docProps/app.xml"] ? strFromU8(zip["docProps/app.xml"]) : "";
  const custom = zip["docProps/custom.xml"] ? strFromU8(zip["docProps/custom.xml"]) : "";

  if (core && hasMeaningfulContent(core, CORE_FIELDS)) {
    findings.push({ id: "docx-core", kind: "office_core", disposition: "privacy_metadata", label: "DOCX core properties", description: "Author, editor, title, timestamps, keywords, or other core document properties are present.", removableByDefault: true });
  }
  if (app && hasMeaningfulContent(app, APP_FIELDS)) {
    findings.push({ id: "docx-app", kind: "office_app", disposition: "privacy_metadata", label: "DOCX application properties", description: "Application, version, company, manager, or template metadata is present.", removableByDefault: true });
  }
  if (custom && /<property\b/i.test(custom)) {
    findings.push({ id: "docx-custom", kind: "office_custom", disposition: "privacy_metadata", label: "DOCX custom properties", description: "Custom Office properties are embedded in the package.", removableByDefault: true });
  }
  return findings;
}

export function sanitizeDocx(bytes: Uint8Array): Uint8Array {
  const zip = unzipDocxSafely(bytes);
  if (zip["docProps/core.xml"]) {
    zip["docProps/core.xml"] = strToU8(blankTags(strFromU8(zip["docProps/core.xml"]), CORE_FIELDS));
  }
  if (zip["docProps/app.xml"]) {
    zip["docProps/app.xml"] = strToU8(blankTags(strFromU8(zip["docProps/app.xml"]), APP_FIELDS));
  }
  if (zip["docProps/custom.xml"]) {
    const custom = strFromU8(zip["docProps/custom.xml"]).replace(/<property\b[\s\S]*?<\/property>/gi, "");
    zip["docProps/custom.xml"] = strToU8(custom);
  }
  return zipSync(zip, { level: 6 });
}
