import { describe, expect, it } from "vitest";
import {
  canonicalizeArtifact,
  createArtifactReceipt,
  inspectArtifactHygiene,
  sha256Hex,
  verifyArtifactReceipt,
} from "../src/lib/artifacts/provenance";

describe("artifact provenance receipts", () => {
  it("canonicalizes JSON key ordering deterministically", async () => {
    const a = canonicalizeArtifact('{"b":2,"a":{"z":3,"y":1}}', "json");
    const b = canonicalizeArtifact(' { "a": { "y": 1, "z": 3 }, "b": 2 } ', "json");
    expect(a.text).toBe(b.text);
    expect(await sha256Hex(a.text)).toBe(await sha256Hex(b.text));
    expect(a.canonicalization).toBe("stable-json-v1");
  });

  it("creates a self-hashed receipt and verifies the artifact locally", async () => {
    const artifact = "# Skill\n\nName: verifier\nPurpose: Verify supplied evidence.";
    const receipt = await createArtifactReceipt(artifact, {
      kind: "agent-skill",
      artifactName: "verifier",
      artifactVersion: "1.0.0",
      previousArtifactHash: "a".repeat(64),
      createdAt: "2026-09-18T00:00:00.000Z",
    });
    expect(receipt.artifactHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(receipt.previousArtifactHash).toBe("a".repeat(64));
    const verified = await verifyArtifactReceipt(artifact, receipt);
    expect(verified.artifactMatches).toBe(true);
    expect(verified.receiptIntegrity).toBe(true);
    expect(verified.chainLinkWellFormed).toBe(true);
  });

  it("detects artifact changes without trusting receipt metadata", async () => {
    const receipt = await createArtifactReceipt("name: safe\npurpose: test", { kind: "agent-skill", createdAt: "2026-09-18T00:00:00.000Z" });
    const verified = await verifyArtifactReceipt("name: changed\npurpose: test", receipt);
    expect(verified.artifactMatches).toBe(false);
    expect(verified.receiptIntegrity).toBe(true);
  });

  it("detects receipt tampering", async () => {
    const receipt = await createArtifactReceipt("plain artifact", { kind: "generic", createdAt: "2026-09-18T00:00:00.000Z" });
    const altered = { ...receipt, artifactVersion: "tampered" };
    const verified = await verifyArtifactReceipt("plain artifact", altered);
    expect(verified.receiptIntegrity).toBe(false);
  });

  it("flags credential-like material without echoing the secret", () => {
    const findings = inspectArtifactHygiene("token=sk-123456789012345678901234567890", "generic");
    const secret = findings.find((item) => item.code === "credential_like_material");
    expect(secret?.severity).toBe("blocked");
    expect(secret?.message).not.toContain("sk-123456789012345678901234567890");
  });

  it("rejects malformed version-chain hashes", async () => {
    await expect(createArtifactReceipt("artifact", { kind: "generic", previousArtifactHash: "not-a-hash" })).rejects.toThrow(/64-character SHA-256/u);
  });
});
