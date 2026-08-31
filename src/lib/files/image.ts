import { ascii, concatBytes, readUint32BE, readUint32LE, startsWithAscii, writeUint32LE } from "./binary";
import type { FileFinding } from "./types";

export interface ImageInspection {
  findings: FileFinding[];
  sanitize: () => Uint8Array;
}

const finding = (
  id: string,
  kind: FileFinding["kind"],
  disposition: FileFinding["disposition"],
  label: string,
  description: string,
  removableByDefault: boolean,
  offset?: number,
  size?: number,
): FileFinding => ({ id, kind, disposition, label, description, removableByDefault, offset, size });

function jpegSegments(bytes: Uint8Array) {
  const segments: Array<{ start: number; end: number; marker: number; payload: Uint8Array }> = [];
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid JPEG signature");
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const start = offset;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      segments.push({ start, end: offset, marker, payload: new Uint8Array() });
      break;
    }
    if (marker === 0xda) {
      const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
      const headerEnd = offset + length;
      segments.push({ start, end: bytes.length, marker, payload: bytes.subarray(offset + 2, headerEnd) });
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      segments.push({ start, end: offset, marker, payload: new Uint8Array() });
      continue;
    }
    if (offset + 1 >= bytes.length) break;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) break;
    const end = offset + length;
    segments.push({ start, end, marker, payload: bytes.subarray(offset + 2, end) });
    offset = end;
  }
  return segments;
}

export function inspectJpeg(bytes: Uint8Array): ImageInspection {
  const segments = jpegSegments(bytes);
  const findings: FileFinding[] = [];
  const removableStarts = new Set<number>();

  for (const segment of segments) {
    const payload = segment.payload;
    if (segment.marker === 0xe1 && startsWithAscii(payload, "Exif\0\0")) {
      findings.push(finding(`jpeg-${segment.start}-exif`, "exif", "privacy_metadata", "EXIF metadata", "Camera/device and capture metadata embedded in an APP1 segment.", true, segment.start, segment.end - segment.start));
      removableStarts.add(segment.start);
    } else if (
      segment.marker === 0xe1 &&
      (startsWithAscii(payload, "http://ns.adobe.com/xap/1.0/\0") || startsWithAscii(payload, "http://ns.adobe.com/xmp/extension/"))
    ) {
      findings.push(finding(`jpeg-${segment.start}-xmp`, "xmp", "privacy_metadata", "XMP metadata", "Extensible metadata that may include application, author, edit, or provenance-related fields.", true, segment.start, segment.end - segment.start));
      removableStarts.add(segment.start);
    } else if (segment.marker === 0xed) {
      findings.push(finding(`jpeg-${segment.start}-iptc`, "iptc", "privacy_metadata", "IPTC / APP13 metadata", "Editorial metadata such as creator, caption, copyright, or workflow fields.", true, segment.start, segment.end - segment.start));
      removableStarts.add(segment.start);
    } else if (segment.marker === 0xfe) {
      findings.push(finding(`jpeg-${segment.start}-comment`, "comment", "privacy_metadata", "JPEG comment", "Free-form comment metadata embedded in the JPEG.", true, segment.start, segment.end - segment.start));
      removableStarts.add(segment.start);
    } else if (segment.marker === 0xeb) {
      findings.push(finding(`jpeg-${segment.start}-app11`, "provenance_manifest", "provenance", "APP11 / JUMBF candidate", "APP11 is used by JUMBF-based provenance systems such as C2PA. Preserved by default.", false, segment.start, segment.end - segment.start));
    }
  }

  return {
    findings,
    sanitize: () => {
      const parts: Uint8Array[] = [bytes.subarray(0, 2)];
      let cursor = 2;
      for (const segment of segments) {
        if (segment.start < cursor) continue;
        if (segment.start > cursor) parts.push(bytes.subarray(cursor, segment.start));
        if (!removableStarts.has(segment.start)) parts.push(bytes.subarray(segment.start, segment.end));
        cursor = segment.end;
        if (segment.marker === 0xda) break;
      }
      if (cursor < bytes.length) parts.push(bytes.subarray(cursor));
      return concatBytes(parts);
    },
  };
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function assertPng(bytes: Uint8Array) {
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) throw new Error("Invalid PNG signature");
}

export function inspectPng(bytes: Uint8Array): ImageInspection {
  assertPng(bytes);
  const findings: FileFinding[] = [];
  const removableOffsets = new Set<number>();
  const chunks: Array<{ start: number; end: number; type: string }> = [];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    chunks.push({ start: offset, end, type });

    if (type === "eXIf") {
      findings.push(finding(`png-${offset}-exif`, "exif", "privacy_metadata", "PNG EXIF chunk", "EXIF camera/device and capture metadata.", true, offset, end - offset));
      removableOffsets.add(offset);
    } else if (["tEXt", "zTXt", "iTXt"].includes(type)) {
      findings.push(finding(`png-${offset}-${type}`, "text_chunk", "privacy_metadata", `${type} text metadata`, "Textual PNG metadata that may expose authoring, software, comments, or workflow information.", true, offset, end - offset));
      removableOffsets.add(offset);
    } else if (type === "tIME") {
      findings.push(finding(`png-${offset}-time`, "text_chunk", "privacy_metadata", "PNG modification time", "Embedded modification timestamp.", true, offset, end - offset));
      removableOffsets.add(offset);
    } else if (type === "caBX") {
      findings.push(finding(`png-${offset}-cabx`, "provenance_manifest", "provenance", "C2PA caBX chunk", "Signed provenance manifest. Preserved by default so authenticity information is not silently destroyed.", false, offset, end - offset));
    }

    offset = end;
    if (type === "IEND") break;
  }

  return {
    findings,
    sanitize: () => {
      const parts = [bytes.subarray(0, 8)];
      for (const chunk of chunks) {
        if (!removableOffsets.has(chunk.start)) parts.push(bytes.subarray(chunk.start, chunk.end));
      }
      return concatBytes(parts);
    },
  };
}

export function inspectWebp(bytes: Uint8Array): ImageInspection {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") throw new Error("Invalid WebP signature");
  const findings: FileFinding[] = [];
  const removableOffsets = new Set<number>();
  const chunks: Array<{ start: number; end: number; type: string; dataStart: number; dataEnd: number }> = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, offset + 4);
    const size = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    const end = dataEnd + (size % 2);
    if (end > bytes.length) break;
    chunks.push({ start: offset, end, type, dataStart, dataEnd });

    if (type === "EXIF") {
      findings.push(finding(`webp-${offset}-exif`, "exif", "privacy_metadata", "WebP EXIF chunk", "Camera/device and capture metadata.", true, offset, end - offset));
      removableOffsets.add(offset);
    } else if (type === "XMP ") {
      findings.push(finding(`webp-${offset}-xmp`, "xmp", "privacy_metadata", "WebP XMP chunk", "Extensible metadata that may expose authoring or workflow information.", true, offset, end - offset));
      removableOffsets.add(offset);
    } else if (["C2PA", "JUMB"].includes(type)) {
      findings.push(finding(`webp-${offset}-provenance`, "provenance_manifest", "provenance", `${type.trim()} provenance chunk`, "Potential signed provenance content. Preserved by default.", false, offset, end - offset));
    }
    offset = end;
  }

  return {
    findings,
    sanitize: () => {
      const outputChunks: Uint8Array[] = [];
      for (const chunk of chunks) {
        if (removableOffsets.has(chunk.start)) continue;
        const copy = bytes.slice(chunk.start, chunk.end);
        if (chunk.type === "VP8X" && copy.length >= 9) {
          copy[8] &= ~0x0c;
        }
        outputChunks.push(copy);
      }
      const body = concatBytes(outputChunks);
      const header = bytes.slice(0, 12);
      writeUint32LE(header, 4, body.length + 4);
      return concatBytes([header, body]);
    },
  };
}
