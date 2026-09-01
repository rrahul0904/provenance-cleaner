"use client";

import { useState } from "react";
import { verifyC2pa } from "@/lib/c2pa/browser";
import type { C2paVerificationReceipt } from "@/lib/c2pa/types";
import { inspectFile, sanitizeFile } from "@/lib/files";
import { sha256Hex } from "@/lib/files/hash";
import { buildVerificationReceipt } from "@/lib/files/verification-receipt";
import type { FileInspectionReceipt, FileSanitizeResult } from "@/lib/files";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.docx,.pdf,image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function FileWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<FileInspectionReceipt | null>(null);
  const [originalHash, setOriginalHash] = useState<string | null>(null);
  const [cleaned, setCleaned] = useState<FileSanitizeResult | null>(null);
  const [cleanedHash, setCleanedHash] = useState<string | null>(null);
  const [c2pa, setC2pa] = useState<C2paVerificationReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [c2paBusy, setC2paBusy] = useState(false);

  async function bytesForSelected() {
    if (!file) throw new Error("Choose a file first.");
    if (file.size > MAX_BYTES) throw new Error("Phase 2 limits local files to 20 MB.");
    return new Uint8Array(await file.arrayBuffer());
  }

  async function runInspection() {
    setBusy(true);
    setError(null);
    setCleaned(null);
    setCleanedHash(null);
    setC2pa(null);
    try {
      const bytes = await bytesForSelected();
      const nextReceipt = inspectFile(bytes, file!.name);
      const hash = await sha256Hex(bytes);
      setReceipt(nextReceipt);
      setOriginalHash(hash);
    } catch (cause) {
      setReceipt(null);
      setOriginalHash(null);
      setError(cause instanceof Error ? cause.message : "Could not inspect this file.");
    } finally {
      setBusy(false);
    }
  }

  async function runC2paVerification() {
    if (!file || !receipt) return;
    setC2paBusy(true);
    setError(null);
    try {
      setC2pa(await verifyC2pa(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify Content Credentials.");
    } finally {
      setC2paBusy(false);
    }
  }

  async function runSanitize() {
    setBusy(true);
    setError(null);
    try {
      const bytes = await bytesForSelected();
      const result = sanitizeFile(bytes, file!.name);
      setReceipt(result.before);
      setCleaned(result);
      setCleanedHash(await sha256Hex(result.output));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sanitize this file.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCleaned() {
    if (!cleaned) return;
    const copy = cleaned.output.slice();
    downloadBlob(new Blob([copy.buffer], { type: cleaned.mimeType }), cleaned.outputFileName);
  }

  function downloadReceipt() {
    if (!receipt || !originalHash) return;
    const exportable = buildVerificationReceipt({
      originalHash,
      inspection: receipt,
      c2pa,
      cleaned,
      cleanedHash,
    });
    const name = `${baseName(receipt.file.name)}.verification.json`;
    downloadBlob(new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" }), name);
  }

  const sanitizeBlocked = !receipt || !receipt.capabilities.sanitize;
  const hasProvenance = Boolean(receipt?.summary.provenance);
  const canVerifyC2pa = Boolean(receipt && receipt.file.format !== "docx");

  return (
    <section className="file-section" aria-label="File metadata scanner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Phase 2 · verified provenance</p>
          <h2>Inspect, verify, then decide.</h2>
          <p>Local metadata inspection is fast and deterministic. Content Credentials verification uses the official C2PA browser SDK only when you request it.</p>
        </div>
        <span className="pill">20 MB local limit</span>
      </div>

      <div className="file-grid">
        <div className="panel file-drop-panel">
          <label className="drop-zone">
            <input
              type="file"
              accept={ACCEPT}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setReceipt(null);
                setOriginalHash(null);
                setCleaned(null);
                setCleanedHash(null);
                setC2pa(null);
                setError(null);
              }}
            />
            <strong>{file ? file.name : "Choose a document or image"}</strong>
            <span>{file ? `${formatBytes(file.size)} · ready for local inspection` : "JPEG · PNG · WebP · DOCX · PDF"}</span>
          </label>

          <div className="actions">
            <button className="primary" disabled={!file || busy} onClick={runInspection}>{busy ? "Working…" : "Inspect file"}</button>
            <button className="secondary" disabled={!file || busy || sanitizeBlocked} onClick={runSanitize}>{hasProvenance ? "Sanitization blocked" : "Sanitize privacy metadata"}</button>
            {canVerifyC2pa && <button className="secondary" disabled={c2paBusy} onClick={runC2paVerification}>{c2paBusy ? "Verifying…" : "Verify Content Credentials"}</button>}
            {cleaned && <button className="ghost" onClick={downloadCleaned}>Download cleaned copy</button>}
            {receipt && originalHash && <button className="ghost" onClick={downloadReceipt}>Export JSON receipt</button>}
          </div>
          <p className="privacy-note">Inspect first. Provenance-bearing assets are never modified by default because byte changes can invalidate signed hard bindings.</p>
          {error && <div className="error-card">{error}</div>}
        </div>

        <div className="panel file-receipt-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Verification receipt</p>
              <h2>{receipt ? `${receipt.summary.total} metadata finding${receipt.summary.total === 1 ? "" : "s"}` : "Ready to inspect"}</h2>
            </div>
            {receipt && <span className={`score ${receipt.summary.provenance ? "warn" : "ok"}`}>{receipt.summary.provenance ? "Provenance" : "Inspected"}</span>}
          </div>

          {!receipt ? (
            <div className="empty-state compact">Choose a supported file to see metadata categories, hashes, removal policy and optional Content Credentials verification.</div>
          ) : (
            <>
              <div className="metrics">
                <Metric label="Privacy metadata" value={receipt.summary.privacyMetadata} />
                <Metric label="Provenance" value={receipt.summary.provenance} />
                <Metric label="Safe removals" value={receipt.summary.removableByDefault} />
              </div>
              <div className="file-meta-line"><span>{receipt.file.format.toUpperCase()}</span><span>{formatBytes(receipt.file.bytes)}</span><span>{receipt.capabilities.sanitize ? "sanitizable" : "inspection only"}</span></div>
              {originalHash && <div className="file-meta-line"><span>SHA-256</span><span title={originalHash}>{shortHash(originalHash)}</span></div>}
              <div className="findings file-findings">
                {receipt.findings.length === 0 ? (
                  <div className="success-card">No tracked metadata was found.</div>
                ) : receipt.findings.map((item) => (
                  <article className="finding" key={item.id}>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <span className={item.removableByDefault ? "tag-safe" : "tag-review"}>{item.removableByDefault ? "remove" : "preserve"}</span>
                  </article>
                ))}
              </div>
            </>
          )}

          {c2pa && (
            <div className={c2pa.status === "valid" || c2pa.status === "not_present" ? "verification-box" : "notice-card"}>
              <strong>Content Credentials · {formatC2paStatus(c2pa.status)}</strong>
              <div className="verification-stats">
                <span>{c2pa.manifestCount} manifest{c2pa.manifestCount === 1 ? "" : "s"}</span>
                <span>{c2pa.validation.length} validation status{c2pa.validation.length === 1 ? "" : "es"}</span>
              </div>
              <p>{c2pa.note}</p>
              {c2pa.validation.slice(0, 4).map((item) => <p key={`${item.code}-${item.url ?? ""}`}><strong>{item.code}</strong>{item.explanation ? ` · ${item.explanation}` : ""}</p>)}
            </div>
          )}

          {cleaned && (
            <div className="verification-box">
              <strong>Post-clean verification</strong>
              <div className="verification-stats">
                <span>{cleaned.removed.length} removed</span>
                <span>{cleaned.after.summary.removableByDefault} removable findings remain</span>
                {cleanedHash && <span title={cleanedHash}>SHA {shortHash(cleanedHash)}</span>}
              </div>
              <p>The cleaned bytes were re-scanned and re-hashed before the download became available.</p>
            </div>
          )}

          {hasProvenance && (
            <div className="notice-card">A provenance candidate is present. Even if its metadata chunk is copied forward, changing other bytes can break the signed hard binding. Sanitization remains blocked.</div>
          )}
          {receipt?.file.format === "pdf" && (
            <div className="notice-card">PDF remains inspection-only. Rewriting arbitrary PDFs safely requires a structure-aware writer that preserves cross-reference tables, signatures, forms and attachments.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

function baseName(name: string) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(0, index) : name;
}

function formatC2paStatus(status: C2paVerificationReceipt["status"]) {
  return status.replaceAll("_", " ");
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
