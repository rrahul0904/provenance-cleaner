"use client";

import { useCallback, useMemo, useState } from "react";
import { creditCostForText } from "@/lib/product-contract";
import type { SanitizeReceipt, TextScanReceipt } from "@/lib/provenance/types";
import { scanText } from "@/lib/provenance/unicode";
import { ForensicTextPreview, OperationStatus } from "./forensic-evidence";
import { emitReceipt } from "./receipt-drawer";
import { TurnstileWidget } from "./turnstile-widget";

const DEMO_TEXT = "A normal sentence\u200B with a hidden zero-width space.\nRTL control example: \u202Ereview me.";

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

function downloadJson(payload: unknown, name: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ScannerWorkbench() {
  const [text, setText] = useState(DEMO_TEXT);
  const [receipt, setReceipt] = useState<TextScanReceipt | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [sanitation, setSanitation] = useState<SanitizeReceipt | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ state: "idle" | "working" | "complete" | "review"; message: string }>({
    state: "idle",
    message: "Ready when you are.",
  });
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const onChallenge = useCallback((token: string | null) => setChallengeToken(token), []);
  const canScan = text.length > 0;
  const estimatedCredits = useMemo(() => creditCostForText(text), [text]);
  const currentScan = useMemo(() => scanText(text), [text]);
  const grouped = useMemo(
    () => receipt ? Object.entries(receipt.summary.byCategory).filter(([, count]) => count > 0) : [],
    [receipt],
  );

  function replaceText(next: string, sourceFile: string | null = null) {
    setText(next);
    setFileName(sourceFile);
    setReceipt(null);
    setReceiptId(null);
    setSanitation(null);
    setBillingNote(null);
    setError(null);
    setStatus({ state: "idle", message: "Ready when you are." });
  }

  async function loadTxt(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
      setError("Choose a plain-text .txt file.");
      return;
    }
    try {
      replaceText(await file.text(), file.name);
    } catch {
      setError("Could not read this text file.");
    }
  }

  function publishScan(next: TextScanReceipt, id: string) {
    emitReceipt({
      id,
      title: "Text inspection receipt",
      operation: fileName ? "txt.scan" : "text.scan",
      status: next.summary.reviewRequired ? "review" : "inspected",
      inputSizeBucket: `${next.input.words} words`,
      findingsDetected: next.summary.total,
      findingsRemoved: 0,
      findingsPreserved: next.summary.total,
      findingsReview: next.summary.reviewRequired,
      verification: "Local deterministic inspection completed. No account or credit mutation was required.",
      details: [
        { label: "Words", value: next.input.words },
        { label: "Safe removals", value: next.summary.safeToRemove },
        { label: "Needs review", value: next.summary.reviewRequired },
      ],
    });
  }

  function runScan() {
    if (!canScan) return;
    setStatus({ state: "working", message: "Inspecting content…" });
    window.requestAnimationFrame(() => {
      const next = scanText(text);
      const id = crypto.randomUUID();
      setReceipt(next);
      setReceiptId(id);
      setSanitation(null);
      setBillingNote(null);
      setStatus({
        state: next.summary.reviewRequired ? "review" : "complete",
        message: next.summary.reviewRequired ? "Inspection complete. Some findings need review." : "Inspection complete.",
      });
      publishScan(next, id);
    });
  }

  function exportReceipt() {
    if (!receipt) return;
    downloadJson({
      version: "text-scan-receipt-v1",
      id: receiptId ?? crypto.randomUUID(),
      input: { kind: fileName ? "txt" : "text", words: receipt.input.words },
      summary: receipt.summary,
      findings: receipt.findings.map((item) => ({
        codePoint: item.codePoint,
        characterName: item.characterName,
        index: item.index,
        category: item.category,
        disposition: item.disposition,
        description: item.description,
      })),
      sanitation: sanitation ? {
        removed: sanitation.removed.length,
        preservedForReview: sanitation.preservedForReview.length,
      } : null,
    }, `provenance-text-receipt-${(receiptId ?? "local").slice(0, 12)}.json`);
  }

  async function cleanConservatively() {
    if (!challengeToken || !canScan) return;
    setBusy(true);
    setError(null);
    setBillingNote(null);
    setStatus({ state: "working", message: "Preparing verified cleaning…" });

    try {
      const sessionResponse = await fetch("/api/auth/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeToken, forClean: true }),
      });
      const sessionPayload = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(messageFrom(sessionPayload, "Could not prepare the clean operation."));

      setStatus({ state: "working", message: "Removing safe findings and verifying output…" });
      const response = await fetch("/api/text/sanitize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationId: crypto.randomUUID(), text, kind: fileName ? "txt" : "text" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(messageFrom(payload, "Could not clean this text."));

      const next = payload.sanitation as SanitizeReceipt;
      const verified = scanText(next.output);
      const operationId = String(payload.billing.operationId);
      setSanitation(next);
      setReceipt(verified);
      setReceiptId(operationId);
      setBillingNote(`${payload.billing.creditsCharged} credit${payload.billing.creditsCharged === 1 ? "" : "s"} charged · ${payload.billing.balanceAfter} remaining`);
      setStatus({
        state: verified.summary.safeToRemove === 0 ? "complete" : "review",
        message: verified.summary.safeToRemove === 0 ? "Verified. Safe findings were removed and the output was re-inspected." : "Cleaning finished, but post-clean verification needs review.",
      });

      emitReceipt({
        id: operationId,
        title: "Conservative text cleaning",
        operation: fileName ? "txt.sanitize" : "text.sanitize",
        status: verified.summary.reviewRequired ? "review" : "validated",
        accountState: sessionPayload?.isAnonymous === false ? "registered" : "guest",
        creditsReserved: Number(payload.billing.creditsCharged),
        creditsCommitted: Number(payload.billing.creditsCharged),
        inputSizeBucket: `${currentScan.input.words} words`,
        findingsDetected: currentScan.summary.total,
        findingsRemoved: next.removed.length,
        findingsPreserved: next.preservedForReview.length,
        findingsReview: next.preservedForReview.length,
        verification: verified.summary.safeToRemove === 0
          ? "Post-clean scan confirms all conservatively safe removals are clear."
          : "Post-clean verification requires review.",
        details: [
          { label: "Balance after", value: Number(payload.billing.balanceAfter) },
          { label: "Review preserved", value: next.preservedForReview.length },
        ],
      });
      window.dispatchEvent(new Event("provenance:account-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clean this text.");
      setStatus({ state: "review", message: "The clean operation did not produce a verified result." });
    } finally {
      setBusy(false);
      setChallengeToken(null);
      setChallengeReset((value) => value + 1);
    }
  }

  return <section className="workbench" aria-label="Provenance text scanner">
    <div className="panel editor-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Free text scanner</p><h2>Inspect before you clean.</h2></div>
        <span className="pill local-pill">local-first · 0 credits</span>
      </div>

      <div className="input-toolbar">
        <div className="actions">
          <label className="secondary upload-action">Upload .txt
            <input type="file" accept=".txt,text/plain" hidden onChange={(event) => void loadTxt(event.target.files?.[0] ?? null)} />
          </label>
          <button className="ghost" onClick={() => replaceText(DEMO_TEXT)}>Try example</button>
          {fileName && <span className="pill">TXT input</span>}
        </div>
        <span className="mono-label">{currentScan.input.words} WORDS</span>
      </div>

      <textarea value={text} onChange={(event) => replaceText(event.target.value)} spellCheck={false} aria-label="Text to scan" />

      <div className="actions primary-actions">
        <button className="primary" onClick={runScan} disabled={!canScan}>Scan text — free</button>
        <button className="secondary" onClick={() => void cleanConservatively()} disabled={!canScan || busy || !challengeToken}>
          {busy ? "Cleaning…" : `Clean safe findings · ${estimatedCredits} credit${estimatedCredits === 1 ? "" : "s"}`}
        </button>
        <button className="ghost" onClick={() => replaceText("")}>Clear</button>
      </div>

      <TurnstileWidget action="account" onToken={onChallenge} resetKey={challengeReset} />
      <OperationStatus state={status.state} message={status.message} />

      <div className="trust-note">
        <span className="status-dot"/>
        <div><strong>Scan stays local.</strong><p>A guest is created only when a billable clean actually needs authoritative credit state. Raw text is not intentionally persisted.</p></div>
      </div>
      {billingNote && <div className="success-card">{billingNote}</div>}
      {error && <div className="error-card" role="alert">{error}</div>}
    </div>

    <div className="panel receipt-panel" aria-label="Verification receipt">
      <div className="panel-heading">
        <div><p className="eyebrow">Verification receipt</p><h2>{receipt ? `${receipt.summary.total} finding${receipt.summary.total === 1 ? "" : "s"}` : "Ready to scan"}</h2></div>
        {receipt && <span className={`score ${receipt.summary.reviewRequired ? "warn" : "ok"}`}>{receipt.summary.reviewRequired ? "Review" : "Clean"}</span>}
      </div>

      {!receipt ? <div className="empty-state">
        <div><span className="empty-symbol">⌁</span><strong>No evidence yet</strong><p>Paste text or upload a .txt file. A free local scan reveals exact code points, positions, and removal safety.</p></div>
      </div> : <>
        <div className="result-summary-card">
          <div><span>Outcome</span><strong>{receipt.summary.reviewRequired ? "Review required" : "No review required"}</strong></div>
          <p>{receipt.summary.safeToRemove} safe removal{receipt.summary.safeToRemove === 1 ? "" : "s"} · {receipt.summary.reviewRequired} item{receipt.summary.reviewRequired === 1 ? "" : "s"} to review</p>
        </div>

        <div className="metrics">
          <Metric label="Words" value={receipt.input.words} />
          <Metric label="Safe removals" value={receipt.summary.safeToRemove} />
          <Metric label="Needs review" value={receipt.summary.reviewRequired} />
        </div>

        {grouped.length > 0 && <details className="evidence-disclosure">
          <summary>Technical categories <span>{grouped.length}</span></summary>
          <div className="category-row">{grouped.map(([category, count]) => <span className="category" key={category}>{category.replaceAll("_", " ")} · {count}</span>)}</div>
        </details>}

        <ForensicTextPreview text={text} findings={receipt.findings} />

        <div className="receipt-tools">
          <button className="ghost" type="button" onClick={exportReceipt}>Export JSON receipt</button>
          {receiptId && <button className="ghost" type="button" onClick={() => publishScan(receipt, receiptId)}>View receipt</button>}
        </div>
      </>}

      {sanitation && <div className="clean-output">
        <div className="output-heading"><strong>Conservative cleaned output</strong><button className="copy" onClick={() => navigator.clipboard.writeText(sanitation.output)}>Copy</button></div>
        <pre>{sanitation.output || "(empty)"}</pre>
        <p>{sanitation.removed.length} removed · {sanitation.preservedForReview.length} preserved for review · post-clean scan {scanText(sanitation.output).summary.safeToRemove === 0 ? "safe removals clear" : "failed"}</p>
      </div>}
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
