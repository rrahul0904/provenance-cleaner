import type { C2paValidationItem, C2paVerificationReceipt, C2paVerificationStatus } from "./types";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

function normalizeValidationItems(value: unknown): C2paValidationItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const code = typeof record.code === "string" ? record.code : "unknown";
    return [{
      code,
      ...(typeof record.explanation === "string" ? { explanation: record.explanation } : {}),
      ...(typeof record.url === "string" ? { url: record.url } : {}),
    }];
  });
}

function uniqueValidation(items: C2paValidationItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}|${item.explanation ?? ""}|${item.url ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusFromValidation(hasManifest: boolean, validation: C2paValidationItem[]): C2paVerificationStatus {
  if (!hasManifest) return "not_present";
  if (validation.length === 0) return "valid";

  const codes = validation.map((item) => item.code.toLowerCase());
  if (codes.some((code) => code.includes("untrusted"))) return "untrusted";
  if (codes.some((code) => ["invalid", "mismatch", "revoked", "expired", "malformed", "tampered"].some((token) => code.includes(token)))) {
    return "invalid";
  }
  return "unverifiable";
}

export function normalizeManifestStore(
  storeValue: unknown,
  checkedAt = new Date().toISOString(),
): C2paVerificationReceipt {
  const store = asRecord(storeValue) ?? {};
  const manifests = asRecord(store.manifests) ?? {};
  const manifestLabels = Object.keys(manifests);
  const activeManifest = typeof store.active_manifest === "string"
    ? store.active_manifest
    : typeof store.activeManifest === "string"
      ? store.activeManifest
      : undefined;

  const topLevelValidation = normalizeValidationItems(store.validation_status ?? store.validationStatus);
  const active = activeManifest ? asRecord(manifests[activeManifest]) : null;
  const activeValidation = normalizeValidationItems(active?.validation_status ?? active?.validationStatus);
  const validation = uniqueValidation([...topLevelValidation, ...activeValidation]);
  const hasManifest = manifestLabels.length > 0 || Boolean(activeManifest);
  const status = statusFromValidation(hasManifest, validation);

  const note = status === "valid"
    ? "A C2PA manifest was found and the SDK returned no validation failures in the normalized manifest store."
    : status === "not_present"
      ? "No C2PA manifest was found in the returned manifest store."
      : status === "untrusted"
        ? "A manifest is present, but its signing credential is not trusted under the verifier's current trust configuration."
        : status === "invalid"
          ? "A manifest is present and the verifier reported a validation failure that indicates the asset or manifest should not be treated as valid."
          : "A manifest is present, but the available validation statuses do not support a clean valid/invalid conclusion.";

  return {
    version: "c2pa-verification-v1",
    checkedAt,
    status,
    ...(activeManifest ? { activeManifest } : {}),
    manifestCount: manifestLabels.length,
    manifestLabels,
    validation,
    verifier: "@contentauth/c2pa-web",
    note,
  };
}
