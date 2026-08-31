import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { FileFinding } from "./types";

const CORE_FIELDS = ["dc:creator", "cp:lastModifiedBy", "dc:title", "dc:subject", "cp:keywords", "dc:description", "dcterms:created", "dcterms:modified"];
const APP_FIELDS = ["Application", "AppVersion", "Company", "Manager", "Template"];

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
  const zip = unzipSync(bytes);
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
  const zip = unzipSync(bytes);
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
