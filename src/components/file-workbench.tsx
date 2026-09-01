"use client";

import { useCallback, useRef, useState } from "react";
import { verifyC2pa } from "@/lib/c2pa/browser";
import type { C2paVerificationReceipt } from "@/lib/c2pa/types";
import { inspectFile } from "@/lib/files";
import { sha256Hex } from "@/lib/files/hash";
import { buildVerificationReceipt } from "@/lib/files/verification-receipt";
import type { FileInspectionReceipt, FileSanitizeResult } from "@/lib/files";
import { isAcceptedFileKind, MAX_FILE_BYTES, validateFileSize } from "@/lib/product-contract";
import { TurnstileWidget } from "./turnstile-widget";

const ADVANCED_MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.docx,.pdf,image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  }
  return fallback;
}

export function FileWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<FileInspectionReceipt | null>(null);
  const [originalHash, setOriginalHash] = useState<string | null>(null);
  const [cleaned, setCleaned] = useState<FileSanitizeResult | null>(null);
  const [cleanedHash, setCleanedHash] = useState<string | null>(null);
  const [c2pa, setC2pa] = useState<C2paVerificationReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [c2paBusy, setC2paBusy] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const selectionToken = useRef(0);
  const onChallenge = useCallback((token: string | null) => setChallengeToken(token), []);

  async function bytesForSelected(selected: File | null = file) {
    if (!selected) throw new Error("Choose a file first.");
    const parityKind = isAcceptedFileKind(selected.name, selected.type);
    if (parityKind && parityKind !== "txt" && !validateFileSize(selected.size)) {
      throw new Error("DOCX, PNG and JPEG files are limited to 3.2 MB per cleaning job.");
    }
    if (!parityKind && selected.size > ADVANCED_MAX_BYTES) throw new Error("Advanced inspection-only files are limited to 20 MB.");
    return new Uint8Array(await selected.arrayBuffer());
  }

  async function runInspection() {
    if (!file) return;
    const selected = file;
    const token = selectionToken.current;
    setBusy(true);
    setError(null);
    setBillingNote(null);
    setCleaned(null);
    setCleanedHash(null);
    setC2pa(null);
    try {
      const bytes = await bytesForSelected(selected);
      const nextReceipt = inspectFile(bytes, selected.name);
      const hash = await sha256Hex(bytes);
      if (token !== selectionToken.current) return;
      setReceipt(nextReceipt);
      setOriginalHash(hash);
    } catch (cause) {
      if (token !== selectionToken.current) return;
      setReceipt(null);
      setOriginalHash(null);
      setError(cause instanceof Error ? cause.message : "Could not inspect this file.");
    } finally {
      setBusy(false);
    }
  }

  async function runC2paVerification() {
    if (!file || !receipt) return;
    const selected = file;
    const token = selectionToken.current;
    setC2paBusy(true);
    setError(null);
    try {
      const next = await verifyC2pa(selected);
      if (token === selectionToken.current) setC2pa(next);
    } catch (cause) {
      if (token === selectionToken.current) setError(cause instanceof Error ? cause.message : "Could not verify Content Credentials.");
    } finally {
      setC2paBusy(false);
    }
  }

  async function runSanitize() {
    if (!file || !receipt || !challengeToken) return;
    const selected = file;
    const before = receipt;
    const token = selectionToken.current;
    setBusy(true);
    setError(null);
    setBillingNote(null);
    try {
      const bytes = await bytesForSelected(selected);
      const sessionResponse = await fetch("/api/auth/anonymous", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeToken, forClean: true }) });
      const sessionPayload = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(messageFrom(sessionPayload, "Could not prepare the account for this cleaning job."));

      const response = await fetch("/api/files/sanitize", {
        method: "POST",
        headers: {
          "content-type": selected.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(selected.name),
          "x-operation-id": crypto.randomUUID(),
        },
        body: bytes,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(messageFrom(payload, "Could not sanitize this file."));
      }
      const output = new Uint8Array(await response.arrayBuffer());
      if (token !== selectionToken.current) return;
      const encodedOutputName = response.headers.get("x-output-file-name");
      let outputFileName = `${baseName(selected.name)}.clean.${selected.name.split(".").pop() ?? "file"}`;
      if (encodedOutputName) { try { outputFileName = decodeURIComponent(encodedOutputName); } catch { /* keep safe fallback */ } }
      const after = inspectFile(output, outputFileName);
      const remainingIds = new Set(after.findings.map(item => item.id));
      const result: FileSanitizeResult = {
        version: "file-sanitize-v1",
        output,
        outputFileName,
        mimeType: response.headers.get("content-type") || before.file.mimeType,
        removed: before.findings.filter(item => item.removableByDefault && !remainingIds.has(item.id)),
        preserved: before.findings.filter(item => !item.removableByDefault || remainingIds.has(item.id)),
        before,
        after,
      };
      setCleaned(result);
      setCleanedHash(await sha256Hex(output));
      const credits = Number(response.headers.get("x-credits-charged") ?? 1);
      const balanceAfter = Number(response.headers.get("x-balance-after") ?? sessionPayload?.balance?.available ?? 0);
      setBillingNote(`${credits} credit${credits === 1 ? "" : "s"} charged · ${balanceAfter} remaining`);
      window.dispatchEvent(new Event("provenance:account-changed"));
    } catch (cause) {
      if (token === selectionToken.current) setError(cause instanceof Error ? cause.message : "Could not sanitize this file.");
    } finally {
      setBusy(false);
      setChallengeToken(null);
      setChallengeReset(value => value + 1);
    }
  }

  function downloadCleaned() {
    if (!cleaned) return;
    const copy = cleaned.output.slice();
    downloadBlob(new Blob([copy.buffer], { type: cleaned.mimeType }), cleaned.outputFileName);
  }

  function downloadReceipt() {
    if (!receipt || !originalHash) return;
    const exportable = buildVerificationReceipt({ originalHash, inspection: receipt, c2pa, cleaned, cleanedHash });
    const name = `${baseName(receipt.file.name)}.verification.json`;
    downloadBlob(new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" }), name);
  }

  const sanitizeBlocked = !receipt || !receipt.capabilities.sanitize;
  const hasProvenance = Boolean(receipt?.summary.provenance);
  const canVerifyC2pa = Boolean(receipt && receipt.file.format !== "docx");
  const selectedParityKind = file ? isAcceptedFileKind(file.name, file.type) : null;

  return (
    <section className="file-section" aria-label="File metadata scanner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">File metadata & provenance</p>
          <h2>Inspect, verify, then decide.</h2>
          <p>DOCX, PNG and JPEG follow the parity cleaning contract at a 3.2 MB maximum. Existing PDF/WebP support remains available as an advanced inspection path. Signed provenance is never silently destroyed.</p>
        </div>
        <span className="pill">DOCX · PNG · JPEG ≤ {(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB</span>
      </div>

      <div className="file-grid">
        <div className="panel file-drop-panel">
          <label className="drop-zone">
            <input type="file" accept={ACCEPT} onChange={(event) => {
              selectionToken.current += 1;
              const next = event.target.files?.[0] ?? null;
              setFile(next); setReceipt(null); setOriginalHash(null); setCleaned(null); setCleanedHash(null); setC2pa(null); setError(null); setBillingNote(null);
            }} />
            <strong>{file ? file.name : "Choose a document or image"}</strong>
            <span>{file ? `${formatBytes(file.size)} · ${selectedParityKind && selectedParityKind !== "txt" ? "1-credit parity file job" : "advanced local inspection"}` : "JPEG · PNG · DOCX · plus PDF/WebP inspection"}</span>
          </label>

          <div className="actions">
            <button className="primary" disabled={!file || busy} onClick={runInspection}>{busy ? "Working…" : "Inspect file"}</button>
            <button className="secondary" disabled={!file || busy || sanitizeBlocked || !challengeToken} onClick={runSanitize}>{hasProvenance ? "Sanitization blocked" : "Sanitize privacy metadata · 1 credit"}</button>
            {canVerifyC2pa && <button className="secondary" disabled={c2paBusy} onClick={runC2paVerification}>{c2paBusy ? "Verifying…" : "Verify Content Credentials"}</button>}
            {cleaned && <button className="ghost" onClick={downloadCleaned}>Download cleaned copy</button>}
            {receipt && originalHash && <button className="ghost" onClick={downloadReceipt}>Export JSON receipt</button>}
          </div>
          {receipt?.capabilities.sanitize && <TurnstileWidget action="account" onToken={onChallenge} resetKey={challengeReset} />}
          <p className="privacy-note">Inspection stays in your browser. Billable DOCX/PNG/JPEG sanitation is processed in memory by the server, re-verified, returned, and not intentionally persisted. Provenance-bearing assets remain blocked because byte changes can invalidate signed hard bindings.</p>
          {billingNote && <div className="success-card">{billingNote}</div>}
          {error && <div className="error-card">{error}</div>}
        </div>

        <div className="panel file-receipt-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Verification receipt</p><h2>{receipt ? `${receipt.summary.total} metadata finding${receipt.summary.total === 1 ? "" : "s"}` : "Ready to inspect"}</h2></div>
            {receipt && <span className={`score ${receipt.summary.provenance ? "warn" : "ok"}`}>{receipt.summary.provenance ? "Provenance" : "Inspected"}</span>}
          </div>

          {!receipt ? <div className="empty-state compact">Choose a supported file to see metadata categories, hashes, removal policy and optional Content Credentials verification.</div> : <>
            <div className="metrics"><Metric label="Privacy metadata" value={receipt.summary.privacyMetadata} /><Metric label="Provenance" value={receipt.summary.provenance} /><Metric label="Safe removals" value={receipt.summary.removableByDefault} /></div>
            <div className="file-meta-line"><span>{receipt.file.format.toUpperCase()}</span><span>{formatBytes(receipt.file.bytes)}</span><span>{receipt.capabilities.sanitize ? "sanitizable" : "inspection only"}</span></div>
            {originalHash && <div className="file-meta-line"><span>Original SHA-256</span><span title={originalHash}>{shortHash(originalHash)}</span></div>}
            <div className="findings file-findings">{receipt.findings.length === 0 ? <div className="success-card">No tracked metadata was found.</div> : receipt.findings.map((item) => <article className="finding" key={item.id}><div><strong>{item.label}</strong><p>{item.description}</p></div><span className={item.removableByDefault ? "tag-safe" : "tag-review"}>{item.removableByDefault ? "remove" : "preserve"}</span></article>)}</div>
          </>}

          {c2pa && <div className={c2pa.status === "valid" || c2pa.status === "not_present" ? "verification-box" : "notice-card"}><strong>Content Credentials · {formatC2paStatus(c2pa.status)}</strong><div className="verification-stats"><span>{c2pa.manifestCount} manifest{c2pa.manifestCount === 1 ? "" : "s"}</span><span>{c2pa.validation.length} validation status{c2pa.validation.length === 1 ? "" : "es"}</span></div><p>{c2pa.note}</p>{c2pa.validation.slice(0, 4).map((item) => <p key={`${item.code}-${item.url ?? ""}`}><strong>{item.code}</strong>{item.explanation ? ` · ${item.explanation}` : ""}</p>)}</div>}

          {cleaned && <div className="verification-box"><strong>Post-clean verification</strong><div className="verification-stats"><span>{cleaned.removed.length} removed</span><span>{cleaned.after.summary.removableByDefault} removable findings remain</span>{cleanedHash && <span title={cleanedHash}>Output SHA {shortHash(cleanedHash)}</span>}</div><p>The server-returned cleaned bytes were re-scanned and re-hashed in the browser. A changed output hash is expected when metadata is removed; content/pixel integrity is verified separately where supported.</p></div>}

          {hasProvenance && <div className="notice-card">A provenance candidate is present. Changing other bytes can break a signed hard binding, so sanitization remains blocked until the integrity consequence is explicit.</div>}
          {receipt?.file.format === "pdf" && <div className="notice-card">PDF remains inspection-only. Rewriting arbitrary PDFs safely requires a structure-aware writer that preserves cross-reference tables, signatures, forms and attachments.</div>}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function shortHash(hash: string) { return `${hash.slice(0, 12)}…${hash.slice(-8)}`; }
function baseName(name: string) { const index = name.lastIndexOf("."); return index > 0 ? name.slice(0, index) : name; }
function formatC2paStatus(status: C2paVerificationReceipt["status"]) { return status.replaceAll("_", " "); }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
