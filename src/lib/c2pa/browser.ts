import { normalizeManifestStore } from "./normalize";
import type { C2paVerificationReceipt } from "./types";

async function loadVerifier() {
  const { createC2pa } = await import("@contentauth/c2pa-web/inline");
  return createC2pa();
}

let verifierPromise: ReturnType<typeof loadVerifier> | null = null;

function verifier() {
  verifierPromise ??= loadVerifier();
  return verifierPromise;
}

function errorReceipt(status: C2paVerificationReceipt["status"], cause: unknown): C2paVerificationReceipt {
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    version: "c2pa-verification-v1",
    checkedAt: new Date().toISOString(),
    status,
    manifestCount: 0,
    manifestLabels: [],
    validation: [],
    verifier: "@contentauth/c2pa-web",
    note: status === "not_present"
      ? "No readable C2PA manifest was found in this asset."
      : status === "unsupported"
        ? "The official C2PA browser verifier does not support this asset in the current verification path."
        : "The official C2PA verifier could not reach a conclusive result for this asset.",
    technicalError: message,
  };
}

export async function verifyC2pa(file: File): Promise<C2paVerificationReceipt> {
  if (file.size > 20 * 1024 * 1024) {
    return errorReceipt("unsupported", new Error("Phase 2 verification is limited to 20 MB per local file."));
  }

  try {
    const c2pa = await verifier();
    const reader = await c2pa.reader.fromBlob(
      file.type || "application/octet-stream",
      file,
      { verify: { verifyTrust: true } },
    );

    if (!reader) {
      return {
        version: "c2pa-verification-v1",
        checkedAt: new Date().toISOString(),
        status: "not_present",
        manifestCount: 0,
        manifestLabels: [],
        validation: [],
        verifier: "@contentauth/c2pa-web",
        note: "The official C2PA reader found no manifest in this asset.",
      };
    }

    try {
      const store = await reader.manifestStore();
      return normalizeManifestStore(store);
    } finally {
      await reader.free();
    }
  } catch (cause) {
    const message = (cause instanceof Error ? cause.message : String(cause)).toLowerCase();
    if ((message.includes("manifest") && (message.includes("not found") || message.includes("no manifest"))) || message.includes("no c2pa")) {
      return errorReceipt("not_present", cause);
    }
    if (message.includes("unsupported") || message.includes("format")) {
      return errorReceipt("unsupported", cause);
    }
    return errorReceipt("unverifiable", cause);
  }
}

export type { C2paVerificationReceipt } from "./types";
