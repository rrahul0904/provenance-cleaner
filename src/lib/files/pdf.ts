import { latin1 } from "./binary";
import type { FileFinding } from "./types";

export function inspectPdf(bytes: Uint8Array): FileFinding[] {
  const text = latin1(bytes);
  const findings: FileFinding[] = [];
  const add = (id: string, kind: FileFinding["kind"], label: string, description: string, disposition: FileFinding["disposition"] = "privacy_metadata") => {
    findings.push({ id, kind, label, description, disposition, removableByDefault: false });
  };

  const infoKeys = ["Author", "Creator", "Producer", "CreationDate", "ModDate", "Title", "Subject", "Keywords"];
  const present = infoKeys.filter((key) => new RegExp(`\\/${key}\\s*(?:\\(|<)`, "m").test(text));
  if (present.length) add("pdf-info", "pdf_info", "PDF document information", `Document Info fields detected: ${present.join(", ")}. PDF rewriting is inspection-only in this phase to avoid corrupting signed or structurally complex files.`);

  if (/<x:xmpmeta\b|<rdf:RDF\b|adobe:ns:meta\//i.test(text)) {
    add("pdf-xmp", "pdf_xmp", "PDF XMP packet", "Embedded XMP metadata detected. Inspection-only until the PDF rewrite path can preserve cross-reference integrity.");
  }

  if (/c2pa|jumbf|contentauth|content credentials/i.test(text)) {
    add("pdf-provenance", "provenance_manifest", "Potential provenance manifest", "Potential signed provenance markers detected. These are never removed by default.", "provenance");
  }

  return findings;
}
