import { describe, expect, it } from "vitest";
import { normalizeManifestStore } from "../src/lib/c2pa/normalize";

const checkedAt = "2026-08-31T00:00:00.000Z";

describe("C2PA manifest normalization", () => {
  it("reports no manifest when the store is empty", () => {
    const receipt = normalizeManifestStore({}, checkedAt);
    expect(receipt.status).toBe("not_present");
    expect(receipt.manifestCount).toBe(0);
  });

  it("reports a manifest with no validation failures as valid", () => {
    const receipt = normalizeManifestStore({
      active_manifest: "urn:manifest:1",
      manifests: { "urn:manifest:1": {} },
    }, checkedAt);
    expect(receipt.status).toBe("valid");
    expect(receipt.activeManifest).toBe("urn:manifest:1");
  });

  it("separates untrusted credentials from cryptographic invalidity", () => {
    const receipt = normalizeManifestStore({
      active_manifest: "urn:manifest:1",
      manifests: {
        "urn:manifest:1": {
          validation_status: [{ code: "signingCredential.untrusted", explanation: "No trusted anchor" }],
        },
      },
    }, checkedAt);
    expect(receipt.status).toBe("untrusted");
  });

  it("marks mismatch validation failures invalid", () => {
    const receipt = normalizeManifestStore({
      active_manifest: "urn:manifest:1",
      manifests: { "urn:manifest:1": {} },
      validation_status: [{ code: "claimSignature.mismatch" }],
    }, checkedAt);
    expect(receipt.status).toBe("invalid");
  });

  it("lets cryptographic invalidity outrank an untrusted signer", () => {
    const receipt = normalizeManifestStore({
      active_manifest: "urn:manifest:1",
      manifests: { "urn:manifest:1": { validation_status: [{ code: "signingCredential.untrusted" }] } },
      validation_status: [{ code: "claimSignature.mismatch" }],
    }, checkedAt);
    expect(receipt.status).toBe("invalid");
  });

  it("keeps unknown validation states explicitly unverifiable", () => {
    const receipt = normalizeManifestStore({
      active_manifest: "urn:manifest:1",
      manifests: { "urn:manifest:1": {} },
      validation_status: [{ code: "custom.warning" }],
    }, checkedAt);
    expect(receipt.status).toBe("unverifiable");
  });
});
