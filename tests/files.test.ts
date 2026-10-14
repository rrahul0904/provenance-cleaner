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
  it("blocks JPEG sanitization when an APP11 provenance candidate is present", () => {
    const jpeg = concatBytes([
      u8(0xff, 0xd8),
      jpegSegment(0xe1, concatBytes([text("Exif"), u8(0, 0), text("camera")])),
      jpegSegment(0xeb, text("jumbf-like-payload")),
      u8(0xff, 0xd9),
    ]);
    const before = inspectFile(jpeg, "photo.jpg");
    expect(before.summary.privacyMetadata).toBe(1);
    expect(before.summary.provenance).toBe(1);
    expect(before.capabilities.sanitize).toBe(false);
    expect(() => sanitizeFile(jpeg, "photo.jpg")).toThrow(/cryptographically bound/i);
  });

  it("removes JPEG EXIF when no provenance candidate is present", () => {
    const jpeg = concatBytes([
      u8(0xff, 0xd8),
      jpegSegment(0xe1, concatBytes([text("Exif"), u8(0, 0), text("camera")])),
      u8(0xff, 0xd9),
    ]);
    const cleaned = sanitizeFile(jpeg, "photo.jpg");
    expect(cleaned.before.summary.privacyMetadata).toBe(1);
    expect(cleaned.after.summary.privacyMetadata).toBe(0);
  });

  it("rejects JPEG segments without valid bounds or a terminal marker", () => {
    const truncatedSegment = u8(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x45);
    const missingEnd = jpegSegment(0xe1, text("ordinary metadata"));
    const jpegWithoutEnd = concatBytes([u8(0xff, 0xd8), missingEnd]);

    expect(() => inspectFile(truncatedSegment, "truncated.jpg")).toThrow(/segment length is invalid/i);
    expect(() => sanitizeFile(jpegWithoutEnd, "incomplete.jpg")).toThrow(/EOI is missing/i);
  });

  it("blocks PNG sanitization when caBX provenance is present", () => {
    const png = concatBytes([
      u8(137, 80, 78, 71, 13, 10, 26, 10),
      pngChunk("IHDR", u8(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0)),
      pngChunk("tEXt", text("Author\0Example")),
      pngChunk("caBX", text("provenance")),
      pngChunk("IEND"),
    ]);
    const receipt = inspectFile(png, "image.png");
    expect(receipt.summary.removableByDefault).toBe(1);
    expect(receipt.summary.provenance).toBe(1);
    expect(receipt.capabilities.sanitize).toBe(false);
    expect(() => sanitizeFile(png, "image.png")).toThrow(/cryptographically bound/i);
  });

  it("removes PNG privacy metadata while retaining required structural chunks", () => {
    const png = concatBytes([
      u8(137, 80, 78, 71, 13, 10, 26, 10),
      pngChunk("IHDR", u8(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0)),
      pngChunk("tEXt", text("Author\0Example")),
      pngChunk("IDAT", u8(1, 2, 3)),
      pngChunk("IEND"),
    ]);
    const cleaned = sanitizeFile(png, "image.png");

    expect(cleaned.before.summary.privacyMetadata).toBe(1);
    expect(cleaned.after.summary.privacyMetadata).toBe(0);
    expect(cleaned.output).toEqual(concatBytes([
      u8(137, 80, 78, 71, 13, 10, 26, 10),
      pngChunk("IHDR", u8(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0)),
      pngChunk("IDAT", u8(1, 2, 3)),
      pngChunk("IEND"),
    ]));
  });

  it("rejects PNGs with a truncated chunk or missing IEND", () => {
    const signature = u8(137, 80, 78, 71, 13, 10, 26, 10);
    const header = pngChunk("IHDR", u8(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0));
    const truncated = concatBytes([signature, header, u8(0, 0, 0, 20), text("tEXt"), u8(1)]);
    const missingEnd = concatBytes([signature, header, pngChunk("tEXt", text("Author\0Example"))]);

    expect(() => inspectFile(truncated, "truncated.png")).toThrow(/chunk (header )?is truncated/i);
    expect(() => sanitizeFile(missingEnd, "incomplete.png")).toThrow(/IEND is missing/i);
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

  it("rejects WebP files whose RIFF size does not match the chunk data", () => {
    const body = webpChunk("VP8X", u8(0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    const declared = body.length + 4;
    const webp = concatBytes([text("RIFF"), u8(declared & 0xff, (declared >>> 8) & 0xff, (declared >>> 16) & 0xff, (declared >>> 24) & 0xff), text("WEBP"), body]);

    expect(() => inspectFile(webp.subarray(0, webp.length - 1), "truncated.webp")).toThrow(/RIFF size does not match/i);
  });

  it("keeps PDF sanitization disabled while reporting document metadata", () => {
    const pdf = text("%PDF-1.7\n1 0 obj << /Author (Ada) /Producer (Tool) >> endobj\n%%EOF");
    const receipt = inspectFile(pdf, "paper.pdf");
    expect(receipt.capabilities.sanitize).toBe(false);
    expect(receipt.summary.privacyMetadata).toBe(1);
    expect(() => sanitizeFile(pdf, "paper.pdf")).toThrow(/disabled/i);
  });
});
