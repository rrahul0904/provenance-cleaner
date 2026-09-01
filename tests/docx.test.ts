import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { inspectFile, sanitizeFile } from "../src/lib/files";

function fixture() {
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'),
    "word/document.xml": strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'),
    "docProps/core.xml": strToU8('<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Ada</dc:creator><cp:lastModifiedBy>Grace</cp:lastModifiedBy></cp:coreProperties>'),
    "docProps/app.xml": strToU8('<?xml version="1.0"?><Properties><Application>Word</Application><Company>Example</Company></Properties>'),
    "docProps/custom.xml": strToU8('<?xml version="1.0"?><Properties><property name="Internal"><value>secret</value></property></Properties>'),
  });
}

describe("DOCX metadata sanitizer", () => {
  it("removes tracked Office metadata and re-verifies the result", () => {
    const docx = fixture();
    const before = inspectFile(docx, "draft.docx");
    expect(before.summary.privacyMetadata).toBe(3);

    const cleaned = sanitizeFile(docx, "draft.docx");
    expect(cleaned.removed).toHaveLength(3);
    expect(cleaned.after.summary.privacyMetadata).toBe(0);
  });

  it("rejects highly compressed DOCX entries before expansion", () => {
    const bomb = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": new Uint8Array(2 * 1024 * 1024).fill(65),
    }, { level: 9 });
    expect(() => inspectFile(bomb, "bomb.docx")).toThrow(/suspicious compression ratio/i);
  });
});
