"use client";

import { useState } from "react";
import { inspectFile, sanitizeFile } from "@/lib/files";
import type { FileInspectionReceipt, FileSanitizeResult } from "@/lib/files";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.docx,.pdf,image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function FileWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<FileInspectionReceipt | null>(null);
  const [cleaned, setCleaned] = useState<FileSanitizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function bytesForSelected() {
    if (!file) throw new Error("Choose a file first.");
    if (file.size > MAX_BYTES) throw new Error("Phase 1 limits local files to 20 MB.");
    return new Uint8Array(await file.arrayBuffer());
  }

  async function runInspection() {
    setBusy(true);
    setError(null);
    setCleaned(null);
    try {
      const bytes = await bytesForSelected();
      setReceipt(inspectFile(bytes, file!.name));
    } catch (cause) {
      setReceipt(null);
      setError(cause instanceof Error ? cause.message : "Could not inspect this file.");
    } finally {
      setBusy(false);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sanitize this file.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCleaned() {
    if (!cleaned) return;
    const blob = new Blob([cleaned.output], { type: cleaned.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = cleaned.outputFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const isPdf = receipt?.file.format === "pdf";

  return (
    <section className="file-section" aria-label="File metadata scanner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Phase 1 · files</p>
          <h2>Inspect metadata without uploading it.</h2>
          <p>JPEG, PNG, WebP, DOCX and PDF are scanned in your browser. Sanitizing is conservative: privacy metadata is removed; provenance markers are preserved.</p>
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
                setCleaned(null);
                setError(null);
              }}
            />
            <strong>{file ? file.name : "Choose a document or image"}</strong>
            <span>{file ? `${formatBytes(file.size)} · ready for local inspection` : "JPEG · PNG · WebP · DOCX · PDF"}</span>
          </label>

          <div className="actions">
            <button className="primary" disabled={!file || busy} onClick={runInspection}>{busy ? "Working…" : "Inspect file"}</button>
            <button className="secondary" disabled={!file || busy || isPdf} onClick={runSanitize}>Sanitize privacy metadata</button>
            {cleaned && <button className="ghost" onClick={downloadCleaned}>Download cleaned copy</button>}
          </div>
          <p className="privacy-note">No file API call is used in this phase. Processing stays in the browser tab.</p>
          {error && <div className="error-card">{error}</div>}
        </div>

        <div className="panel file-receipt-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">File receipt</p>
              <h2>{receipt ? `${receipt.summary.total} metadata finding${receipt.summary.total === 1 ? "" : "s"}` : "Ready to inspect"}</h2>
            </div>
            {receipt && <span className={`score ${receipt.summary.provenance ? "warn" : "ok"}`}>{receipt.summary.provenance ? "Provenance" : "Inspected"}</span>}
          </div>

          {!receipt ? (
            <div className="empty-state compact">Choose a supported file to see metadata categories, removal policy and verification results.</div>
          ) : (
            <>
              <div className="metrics">
                <Metric label="Privacy metadata" value={receipt.summary.privacyMetadata} />
                <Metric label="Provenance" value={receipt.summary.provenance} />
                <Metric label="Safe removals" value={receipt.summary.removableByDefault} />
              </div>
              <div className="file-meta-line"><span>{receipt.file.format.toUpperCase()}</span><span>{formatBytes(receipt.file.bytes)}</span><span>{receipt.capabilities.sanitize ? "sanitizable" : "inspection only"}</span></div>
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

          {cleaned && (
            <div className="verification-box">
              <strong>Post-clean verification</strong>
              <div className="verification-stats">
                <span>{cleaned.removed.length} removed</span>
                <span>{cleaned.preserved.length} preserved</span>
                <span>{cleaned.after.summary.removableByDefault} removable findings remain</span>
              </div>
              <p>The cleaned bytes were re-scanned before the download became available.</p>
            </div>
          )}

          {receipt?.file.format === "pdf" && (
            <div className="notice-card">PDF is inspection-only in Phase 1. Rewriting arbitrary PDFs safely requires a structure-aware writer that preserves cross-reference tables, signatures, forms and attachments.</div>
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
