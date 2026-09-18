import { scanText } from "@/lib/provenance/unicode";

export const ARTIFACT_KINDS = ["generic", "json", "agent-skill"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export type ArtifactHygieneSeverity = "info" | "review" | "blocked";
export interface ArtifactHygieneFinding {
  code: string;
  severity: ArtifactHygieneSeverity;
  message: string;
  count: number;
}

export interface ArtifactProvenancePayload {
  version: "artifact-provenance-v1";
  artifactKind: ArtifactKind;
  artifactName: string | null;
  artifactVersion: string | null;
  canonicalization: "normalized-text-v1" | "stable-json-v1";
  artifactHash: string;
  previousArtifactHash: string | null;
  createdAt: string;
  hygiene: {
    status: "clean" | "review" | "blocked";
    findings: ArtifactHygieneFinding[];
  };
}

export interface ArtifactProvenanceReceipt extends ArtifactProvenancePayload {
  receiptHash: string;
}

export interface ArtifactVerificationResult {
  artifactMatches: boolean;
  receiptIntegrity: boolean;
  chainLinkWellFormed: boolean;
  expectedArtifactHash: string;
  actualArtifactHash: string;
  expectedReceiptHash: string;
  actualReceiptHash: string;
}

function normalizeText(input: string) {
  return input.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function stableStringify(value: unknown): string {
  const result = JSON.stringify(stableValue(value));
  if (result === undefined) throw new Error("Artifact value cannot be canonically serialized.");
  return result;
}

export function canonicalizeArtifact(input: string, kind: ArtifactKind) {
  const normalized = normalizeText(input);
  const trimmed = normalized.trim();

  if (kind === "json") {
    return { text: stableStringify(JSON.parse(trimmed)), canonicalization: "stable-json-v1" as const };
  }

  if (kind === "agent-skill" && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    try {
      return { text: stableStringify(JSON.parse(trimmed)), canonicalization: "stable-json-v1" as const };
    } catch {
      // Skill artifacts may be Markdown/YAML/plain text. Fall back to normalized text.
    }
  }

  return { text: normalized, canonicalization: "normalized-text-v1" as const };
}

export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function countMatches(text: string, expression: RegExp) {
  return Array.from(text.matchAll(expression)).length;
}

export function inspectArtifactHygiene(input: string, kind: ArtifactKind): ArtifactHygieneFinding[] {
  const findings: ArtifactHygieneFinding[] = [];
  const unicode = scanText(input);

  if (unicode.summary.safeToRemove > 0) {
    findings.push({
      code: "hidden_unicode_safe_remove",
      severity: "review",
      message: "Hidden or control Unicode that is normally safe to remove was detected.",
      count: unicode.summary.safeToRemove,
    });
  }
  if (unicode.summary.reviewRequired > 0) {
    findings.push({
      code: "hidden_unicode_review",
      severity: "review",
      message: "Unicode findings requiring human review were detected.",
      count: unicode.summary.reviewRequired,
    });
  }

  const credentialPatterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/gu,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
    /\bAKIA[0-9A-Z]{16}\b/gu,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
  ];
  const credentials = credentialPatterns.reduce((sum, pattern) => sum + countMatches(input, pattern), 0);
  if (credentials > 0) {
    findings.push({
      code: "credential_like_material",
      severity: "blocked",
      message: "Credential-like material was detected. Rotate/remove secrets before publishing or sharing this artifact.",
      count: credentials,
    });
  }

  const trailingWhitespace = input.split(/\r?\n/u).filter((line) => /[ \t]+$/u.test(line)).length;
  if (trailingWhitespace > 0) {
    findings.push({
      code: "trailing_whitespace",
      severity: "info",
      message: "Lines with trailing whitespace were detected; canonical hashing preserves this content for non-JSON artifacts.",
      count: trailingWhitespace,
    });
  }

  if (kind === "agent-skill") {
    const lowered = input.toLowerCase();
    if (!/(^|\n)#{1,3}\s+.+/u.test(input) && !lowered.includes('"name"') && !lowered.includes("name:")) {
      findings.push({
        code: "skill_identity_missing",
        severity: "review",
        message: "The agent-skill artifact does not expose an obvious name/title field or heading.",
        count: 1,
      });
    }
    if (!lowered.includes("description") && !lowered.includes("instructions") && !lowered.includes("purpose")) {
      findings.push({
        code: "skill_contract_missing",
        severity: "review",
        message: "The agent-skill artifact does not expose an obvious description, instructions, or purpose contract.",
        count: 1,
      });
    }
  }

  return findings;
}

function hygieneStatus(findings: ArtifactHygieneFinding[]) {
  if (findings.some((item) => item.severity === "blocked")) return "blocked" as const;
  if (findings.some((item) => item.severity === "review")) return "review" as const;
  return "clean" as const;
}

export async function createArtifactReceipt(input: string, options: {
  kind: ArtifactKind;
  artifactName?: string;
  artifactVersion?: string;
  previousArtifactHash?: string;
  createdAt?: string;
}): Promise<ArtifactProvenanceReceipt> {
  const canonical = canonicalizeArtifact(input, options.kind);
  const artifactHash = await sha256Hex(canonical.text);
  const previous = options.previousArtifactHash?.trim().toLowerCase() || null;
  if (previous && !/^[a-f0-9]{64}$/u.test(previous)) throw new Error("Previous artifact hash must be a 64-character SHA-256 hex value.");

  const findings = inspectArtifactHygiene(input, options.kind);
  const payload: ArtifactProvenancePayload = {
    version: "artifact-provenance-v1",
    artifactKind: options.kind,
    artifactName: options.artifactName?.trim() || null,
    artifactVersion: options.artifactVersion?.trim() || null,
    canonicalization: canonical.canonicalization,
    artifactHash,
    previousArtifactHash: previous,
    createdAt: options.createdAt ?? new Date().toISOString(),
    hygiene: {
      status: hygieneStatus(findings),
      findings,
    },
  };
  return { ...payload, receiptHash: await sha256Hex(stableStringify(payload)) };
}

export async function verifyArtifactReceipt(input: string, receipt: ArtifactProvenanceReceipt): Promise<ArtifactVerificationResult> {
  const canonical = canonicalizeArtifact(input, receipt.artifactKind);
  const actualArtifactHash = await sha256Hex(canonical.text);
  const { receiptHash, ...payload } = receipt;
  const actualReceiptHash = await sha256Hex(stableStringify(payload));
  const previous = receipt.previousArtifactHash;

  return {
    artifactMatches: actualArtifactHash === receipt.artifactHash,
    receiptIntegrity: actualReceiptHash === receiptHash,
    chainLinkWellFormed: previous === null || /^[a-f0-9]{64}$/u.test(previous),
    expectedArtifactHash: receipt.artifactHash,
    actualArtifactHash,
    expectedReceiptHash: receiptHash,
    actualReceiptHash,
  };
}
