import { describe, expect, it } from "vitest";
import { inspectFile, sanitizeFile } from "../src/lib/files";
import { concatBytes } from "../src/lib/files/binary";

const u8 = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new Uint8Array([...value].map((char) => char.charCodeAt(0)));

function jpegSegment(marker: number, payload: Uint8Array) {
  const length = payload.length + 2;
  return concatBytes([u8(0xff, marker, (length >>> 8) & 0xff, length & 0xff), payload]);
}

function pngChunk(type: string, data = new Uint8Array()) {
  const length = data.length;
  return concatBytes([
    u8((length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff),
    text(type), data, u8(0, 0, 0, 0),
  ]);
}

function webpChunk(type: string, data: Uint8Array) {
  const pad = data.length % 2 ? u8(0) : new Uint8Array();
  const size = data.length;
  return concatBytes([text(type), u8(size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff), data, pad]);
}

describe("file provenance engine", () => {
  it("removes JPEG EXIF while preserving APP11 provenance candidates", () => {
    const jpeg = concatBytes([
      u8(0xff, 0xd8),
      jpegSegment(0xe1, concatBytes([text("Exif"), u8(0, 0), text("camera")])),
      jpegSegment(0xeb, text("jumbf-like-payload")),
      u8(0xff, 0xd9),
    ]);
    const before = inspectFile(jpeg, "photo.jpg");
    expect(before.summary.privacyMetadata).toBe(1);
    expect(before.summary.provenance).toBe(1);

    const cleaned = sanitizeFile(jpeg, "photo.jpg");
    expect(cleaned.after.summary.privacyMetadata).toBe(0);
    expect(cleaned.after.summary.provenance).toBe(1);
  });

  it("removes PNG text metadata and preserves caBX", () => {
    const png = concatBytes([
      u8(137, 80, 78, 71, 13, 10, 26, 10),
      pngChunk("tEXt", text("Author\0Example")),
      pngChunk("caBX", text("provenance")),
      pngChunk("IEND"),
    ]);
    const cleaned = sanitizeFile(png, "image.png");
    expect(cleaned.before.summary.removableByDefault).toBe(1);
    expect(cleaned.after.summary.removableByDefault).toBe(0);
    expect(cleaned.after.summary.provenance).toBe(1);
  });

  it("clears WebP EXIF/XMP chunks and their VP8X flags", () => {
    const vp8x = webpChunk("VP8X", u8(0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    const exif = webpChunk("EXIF", text("camera"));
    const xmp = webpChunk("XMP ", text("author"));
    const body = concatBytes([vp8x, exif, xmp]);
    const size = body.length + 4;
    const webp = concatBytes([text("RIFF"), u8(size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff), text("WEBP"), body]);
    const cleaned = sanitizeFile(webp, "image.webp");
    expect(cleaned.before.summary.privacyMetadata).toBe(2);
    expect(cleaned.after.summary.privacyMetadata).toBe(0);
  });

  it("keeps PDF sanitization disabled while reporting document metadata", () => {
    const pdf = text("%PDF-1.7\n1 0 obj << /Author (Ada) /Producer (Tool) >> endobj\n%%EOF");
    const receipt = inspectFile(pdf, "paper.pdf");
    expect(receipt.capabilities.sanitize).toBe(false);
    expect(receipt.summary.privacyMetadata).toBe(1);
    expect(() => sanitizeFile(pdf, "paper.pdf")).toThrow(/disabled/i);
  });
});
