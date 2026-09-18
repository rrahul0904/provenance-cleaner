"use client";

import { useMemo, useState } from "react";
import {
  ARTIFACT_KINDS,
  createArtifactReceipt,
  type ArtifactKind,
  type ArtifactProvenanceReceipt,
  verifyArtifactReceipt,
  type ArtifactVerificationResult,
} from "@/lib/artifacts/provenance";

const SAMPLE = `# Example Agent Skill

Name: research-summarizer
Purpose: Summarize supplied evidence without inventing claims.

Instructions:
- Cite the supplied evidence.
- Preserve uncertainty.
- Do not expose credentials.
`;

function downloadJson(payload: unknown, name: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ArtifactProvenanceWorkbench() {
  const [artifact, setArtifact] = useState(SAMPLE);
  const [kind, setKind] = useState<ArtifactKind>("agent-skill");
  const [name, setName] = useState("research-summarizer");
  const [version, setVersion] = useState("1.0.0");
  const [previousHash, setPreviousHash] = useState("");
  const [receipt, setReceipt] = useState<ArtifactProvenanceReceipt | null>(null);
  const [receiptJson, setReceiptJson] = useState("");
  const [verification, setVerification] = useState<ArtifactVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocked = useMemo(() => receipt?.hygiene.status === "blocked", [receipt]);

  async function generate() {
    setError(null);
    setVerification(null);
    try {
      const next = await createArtifactReceipt(artifact, {
        kind,
        artifactName: name,
        artifactVersion: version,
        previousArtifactHash: previousHash || undefined,
      });
      setReceipt(next);
      setReceiptJson(JSON.stringify(next, null, 2));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the provenance receipt.");
    }
  }

  async function verify() {
    setError(null);
    try {
      const parsed = JSON.parse(receiptJson) as ArtifactProvenanceReceipt;
      if (parsed.version !== "artifact-provenance-v1" || typeof parsed.receiptHash !== "string") {
        throw new Error("Receipt is not an artifact-provenance-v1 receipt.");
      }
      setVerification(await verifyArtifactReceipt(artifact, parsed));
    } catch (cause) {
      setVerification(null);
      setError(cause instanceof Error ? cause.message : "Could not verify this receipt.");
    }
  }

  return <section className="artifact-provenance-section" aria-label="Artifact provenance workbench">
    <div className="section-heading">
      <div>
        <p className="eyebrow">Artifact provenance</p>
        <h2>Hash the artifact. Verify the receipt.</h2>
        <p>Create local SHA-256 identity and self-hashed receipts for prompts, agent skills, configuration, JSON artifacts, and other AI assets. Optional previous hashes form an explicit version chain.</p>
      </div>
      <span className="pill local-pill">Local · no account</span>
    </div>

    <div className="artifact-grid">
      <div className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Artifact</p><h2>Canonical identity</h2></div><span className="pill">SHA-256</span></div>
        <div className="artifact-controls">
          <label>Artifact kind
            <select value={kind} onChange={(event) => { setKind(event.target.value as ArtifactKind); setReceipt(null); }}>
              {ARTIFACT_KINDS.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="optional" /></label>
          <label>Version<input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="optional" /></label>
        </div>
        <label>Previous artifact SHA-256 (optional chain link)
          <input value={previousHash} onChange={(event) => setPreviousHash(event.target.value)} placeholder="64 hex characters" spellCheck={false} />
        </label>
        <textarea value={artifact} onChange={(event) => { setArtifact(event.target.value); setReceipt(null); setVerification(null); }} spellCheck={false} aria-label="Artifact content" />
        <div className="actions">
          <button className="primary" onClick={() => void generate()} disabled={!artifact}>Generate local receipt</button>
          <button className="ghost" onClick={() => { setArtifact(SAMPLE); setKind("agent-skill"); setReceipt(null); setVerification(null); }}>Try example</button>
        </div>
        <div className="trust-note"><span className="status-dot"/><div><strong>Content stays in this browser.</strong><p>Artifact content is canonicalized and hashed locally. The receipt stores hashes and hygiene results, not a server-side copy of the artifact.</p></div></div>
        {error && <div className="error-card" role="alert">{error}</div>}
      </div>

      <div className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Integrity receipt</p><h2>{receipt ? "Receipt generated" : "Waiting for artifact"}</h2></div>{receipt && <span className={`score ${blocked ? "warn" : "ok"}`}>{receipt.hygiene.status}</span>}</div>
        {!receipt ? <div className="empty-state compact"><div><span className="empty-symbol">#</span><strong>No receipt yet</strong><p>Generate a receipt to see the canonical artifact hash, receipt hash, version-chain link, and deterministic hygiene findings.</p></div></div> : <>
          <div className="artifact-hashes">
            <div><span>Artifact SHA-256</span><code>{receipt.artifactHash}</code></div>
            <div><span>Receipt SHA-256</span><code>{receipt.receiptHash}</code></div>
            <div><span>Canonicalization</span><strong>{receipt.canonicalization}</strong></div>
            <div><span>Previous artifact</span><code>{receipt.previousArtifactHash ?? "none"}</code></div>
          </div>
          <div className="artifact-findings">
            {receipt.hygiene.findings.length === 0 ? <div className="success-card">No deterministic hygiene findings.</div> : receipt.hygiene.findings.map((item) => <div className={`artifact-finding ${item.severity}`} key={item.code}><strong>{item.code}</strong><span>{item.count}</span><p>{item.message}</p></div>)}
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => downloadJson(receipt, `artifact-provenance-${receipt.artifactHash.slice(0, 12)}.json`)}>Export receipt JSON</button>
          </div>
        </>}

        <div className="artifact-verify">
          <p className="eyebrow">Re-verify</p>
          <textarea aria-label="Artifact receipt JSON" value={receiptJson} onChange={(event) => { setReceiptJson(event.target.value); setVerification(null); }} placeholder="Paste an artifact-provenance-v1 receipt…" spellCheck={false} />
          <button className="secondary" onClick={() => void verify()} disabled={!artifact || !receiptJson}>Verify artifact + receipt</button>
          {verification && <div className={`verification-box ${verification.artifactMatches && verification.receiptIntegrity && verification.chainLinkWellFormed ? "" : "verification-failed"}`}>
            <strong>{verification.artifactMatches && verification.receiptIntegrity && verification.chainLinkWellFormed ? "Integrity verified" : "Verification failed"}</strong>
            <div className="verification-stats">
              <span>artifact {verification.artifactMatches ? "match" : "mismatch"}</span>
              <span>receipt {verification.receiptIntegrity ? "intact" : "modified"}</span>
              <span>chain {verification.chainLinkWellFormed ? "well formed" : "invalid"}</span>
            </div>
          </div>}
        </div>
      </div>
    </div>
  </section>;
}
