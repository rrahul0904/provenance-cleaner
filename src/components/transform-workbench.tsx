"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countWords, creditCostForText, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import type { TransformIntensity, TransformMode, TransformPurpose, TransformResult } from "@/lib/transform";
import { OperationStatus, SemanticDiffViewer } from "./forensic-evidence";
import { emitReceipt } from "./receipt-drawer";
import { TurnstileWidget } from "./turnstile-widget";

const MODES: Array<{ id: TransformMode; label: string; description: string }> = [
  { id: "parity", label: "Parity", description: "Replace wording aggressively while holding meaning, protected facts, and approximately the same length." },
  { id: "natural", label: "Natural", description: "Improve flow while retaining the apparent voice." },
  { id: "clarity", label: "Clarity", description: "Make wording and structure easier to follow." },
  { id: "concise", label: "Concise", description: "Reduce repetition without dropping facts or qualifiers." },
  { id: "formal", label: "Formal", description: "Polish the prose for a professional setting." },
];

const INTENSITIES: Array<{ id: TransformIntensity; label: string; description: string }> = [
  { id: "light", label: "Light", description: "Small wording and sentence-level improvements." },
  { id: "balanced", label: "Balanced", description: "Meaningful edits while keeping the source voice recognizable." },
  { id: "strong", label: "Strong", description: "Broader sentence and transition rewrites with the same factual guardrails." },
];

const PURPOSES: Array<{ id: TransformPurpose; label: string }> = [
  { id: "general", label: "General" },
  { id: "email", label: "Email" },
  { id: "work", label: "Work" },
  { id: "academic", label: "Academic" },
  { id: "social", label: "Social" },
];

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    if (typeof error === "string") return error;
  }
  return fallback;
}

function downloadReceipt(result: TransformResult) {
  const safe = {
    version: "semantic-receipt-export-v2",
    operationId: result.billing?.operationId ?? null,
    mode: result.mode,
    intensity: result.intensity,
    purpose: result.purpose,
    model: result.model,
    attempts: result.attempts,
    metrics: result.metrics,
    receipt: result.receipt,
    watermark: result.watermark,
    warnings: result.warnings,
    billing: result.billing,
  };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `provenance-edit-receipt-${String(result.billing?.operationId ?? "local").slice(0, 12)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function TransformWorkbench() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<TransformMode>("parity");
  const [intensity, setIntensity] = useState<TransformIntensity>("balanced");
  const [purpose, setPurpose] = useState<TransformPurpose>("general");
  const [result, setResult] = useState<TransformResult | null>(null);
  const [undoText, setUndoText] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ state: "idle" | "working" | "complete" | "review"; message: string }>({
    state: "idle",
    message: "Ready when you are.",
  });
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const revision = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const onChallenge = useCallback((token: string | null) => setChallengeToken(token), []);
  const selectedMode = useMemo(() => MODES.find((item) => item.id === mode)!, [mode]);
  const selectedIntensity = useMemo(() => INTENSITIES.find((item) => item.id === intensity)!, [intensity]);
  const words = useMemo(() => countWords(text), [text]);
  const estimatedCredits = useMemo(() => creditCostForText(text), [text]);
  const overLimit = words > MAX_REWRITE_WORDS;

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  function invalidateResult() {
    revision.current += 1;
    activeRequest.current?.abort();
    setResult(null);
    setDiffOpen(false);
    setError(null);
    setStatus({ state: "idle", message: "Ready when you are." });
  }

  function publishResult(next: TransformResult) {
    if (!next.billing) return;
    emitReceipt({
      id: next.billing.operationId,
      title: "Protected semantic edit",
      operation: `semantic.${next.mode}`,
      status: "validated",
      creditsReserved: next.billing.creditsCharged,
      creditsCommitted: next.billing.creditsCharged,
      inputSizeBucket: `${next.metrics.sourceWords} words`,
      findingsDetected: next.metrics.protectedTotal,
      findingsPreserved: next.metrics.protectedPreserved,
      findingsReview: Math.max(0, next.metrics.protectedTotal - next.metrics.protectedPreserved),
      verification: "Protected factual spans and deterministic preservation checks passed before the credit debit was committed.",
      details: [
        { label: "Purpose", value: next.purpose },
        { label: "Intensity", value: next.intensity },
        { label: "Protected", value: `${next.metrics.protectedPreserved}/${next.metrics.protectedTotal}` },
        { label: "Length retained", value: `${Math.round(next.receipt.retainedPercent)}%` },
        { label: "Wording replaced", value: `${Math.round(next.receipt.wordingReplacedPercent)}%` },
        { label: "Facts/entities", value: `${next.receipt.checks.numericDateEntityPreserved}/${next.receipt.checks.numericDateEntityExpected}` },
      ],
    });
  }

  async function transform() {
    if (!challengeToken || overLimit || !online) return;

    const requestRevision = revision.current;
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    setDiffOpen(false);
    setStatus({ state: "working", message: "Protecting facts and running the edit…" });

    try {
      const response = await fetch("/api/transform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationId: crypto.randomUUID(), text, mode, intensity, purpose, challengeToken }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(messageFrom(payload, "The edit could not be completed."));
      if (controller.signal.aborted || revision.current !== requestRevision) return;

      const next = payload as TransformResult;
      setResult(next);
      setDiffOpen(true);
      setStatus({ state: "complete", message: "Edit passed preservation checks." });
      publishResult(next);
      window.dispatchEvent(new Event("provenance:account-changed"));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (revision.current === requestRevision) {
        setError(cause instanceof Error ? cause.message : "The edit could not be completed.");
        setStatus({ state: "review", message: "The edit did not return a verified result." });
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setBusy(false);
      setChallengeToken(null);
      setChallengeReset((value) => value + 1);
    }
  }

  function adoptResult() {
    if (!result) return;
    setUndoText(text);
    setText(result.text);
    setResult(null);
    setDiffOpen(false);
    setStatus({ state: "complete", message: "Revised text is now the source. Undo is available." });
  }

  function undoAdopt() {
    if (undoText === null) return;
    setText(undoText);
    setUndoText(null);
    setResult(null);
    setDiffOpen(false);
    setStatus({ state: "complete", message: "Last applied revision was undone." });
  }

  async function copyResult() {
    if (result) await navigator.clipboard.writeText(result.text);
  }

  return <section className="transform-section" aria-label="Semantics-preserving editor">
    <div className="section-heading">
      <div>
        <p className="eyebrow">Protected semantic editing</p>
        <h2>Edit the prose. Keep the facts.</h2>
        <p>Run a quick guest edit without signing in, choose purpose and rewrite intensity, then keep or undo the result. Every paid edit still uses authoritative credits and deterministic preservation checks.</p>
      </div>
      <span className="pill ai-pill">~{estimatedCredits} usage unit{estimatedCredits === 1 ? "" : "s"}</span>
    </div>

    <div className="transform-grid">
      <div className="panel transform-input-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Source</p><h2>Choose an editing goal</h2></div>
          <span className={`pill ${overLimit ? "warn" : ""}`}>{words.toLocaleString()} / {MAX_REWRITE_WORDS.toLocaleString()} words</span>
        </div>

        <div className="mode-row" role="group" aria-label="Editing mode">
          {MODES.map((item) => <button
            key={item.id}
            type="button"
            className={`mode-button ${mode === item.id ? "active" : ""}`}
            aria-pressed={mode === item.id}
            disabled={busy}
            onClick={() => {
              if (mode !== item.id) invalidateResult();
              setMode(item.id);
            }}
          >{item.label}</button>)}
        </div>
        <p className="mode-description">{selectedMode.description}</p>

        <div className="edit-controls">
          <label>Purpose
            <select value={purpose} disabled={busy} onChange={(event) => { invalidateResult(); setPurpose(event.target.value as TransformPurpose); }}>
              {PURPOSES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Rewrite intensity
            <select value={intensity} disabled={busy} onChange={(event) => { invalidateResult(); setIntensity(event.target.value as TransformIntensity); }}>
              {INTENSITIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <p className="mode-description">{selectedIntensity.description}</p>

        <textarea
          value={text}
          maxLength={250_000}
          disabled={busy}
          aria-label="Source text for protected semantic editing"
          placeholder="Paste prose you want to edit…"
          onChange={(event) => {
            invalidateResult();
            setText(event.target.value);
          }}
        />

        {overLimit && <div className="error-card">This edit is {words.toLocaleString()} words. Split it into parts of at most {MAX_REWRITE_WORDS.toLocaleString()} words.</div>}
        {!online && <div className="notice-card" role="status"><strong>Offline mode.</strong> Local inspection remains available, but model-backed edits are disabled until connectivity returns.</div>}

        <div className="editor-readiness">
          <span><strong>{words.toLocaleString()}</strong> words</span>
          <span><strong>~{estimatedCredits}</strong> usage units</span>
          <span><strong>{challengeToken ? "ready" : "required"}</strong> bot verification</span>
          <span><strong>{online ? "online" : "offline"}</strong> network</span>
        </div>

        {online && <TurnstileWidget action="transform" onToken={onChallenge} resetKey={challengeReset} />}

        <div className="actions primary-actions">
          <button
            className="primary"
            aria-label={`Edit for ${selectedMode.label.toLowerCase()}`}
            disabled={busy || text.trim().length < 20 || overLimit || !challengeToken || !online}
            onClick={transform}
          >
            {busy ? "Validating edit…" : `Quick edit · ${selectedMode.label.toLowerCase()}`}
          </button>
          <button className="ghost" disabled={busy || undoText === null} onClick={undoAdopt}>Undo last apply</button>
          <button className="ghost" disabled={busy || !text} onClick={() => { invalidateResult(); setUndoText(null); setText(""); }}>Clear</button>
        </div>

        <OperationStatus state={status.state} message={status.message} />

        <div className="trust-note">
          <span className="status-dot"/>
          <div><strong>No sign-in required for a guest edit.</strong><p>A verified request can create an anonymous guest session server-side. Raw source and result text are not intentionally persisted, logged, or cached by the offline layer.</p></div>
        </div>
        {error && <div className="error-card" role="alert">{error}<p>The account ledger remains authoritative for any reservation or release state.</p></div>}
      </div>

      <div className="panel transform-output-panel" aria-live="polite" aria-label="Verification receipt">
        <div className="panel-heading">
          <div><p className="eyebrow">Validated output</p><h2>{result ? "Edit passed preservation checks" : "Ready when you are"}</h2></div>
          {result && <span className="score ok">Validated</span>}
        </div>

        {!result ? <div className="empty-state compact">
          <div><span className="empty-symbol">≋</span><strong>Output waits for evidence</strong><p>Run an edit to see revised prose, a restrained semantic diff, protected facts, and the committed usage receipt.</p></div>
        </div> : <>
          <div className="result-summary-card semantic-result-summary">
            <div><span>Outcome</span><strong>Edit passed preservation checks</strong></div>
            <p>{result.metrics.protectedPreserved}/{result.metrics.protectedTotal} protected spans preserved · {Math.round(result.receipt.wordingReplacedPercent)}% wording replaced · {result.purpose}/{result.intensity}</p>
          </div>

          <div className="transform-metrics">
            <Metric label="Protected" value={`${result.metrics.protectedPreserved}/${result.metrics.protectedTotal}`} />
            <Metric label="Length retained" value={`${Math.round(result.receipt.retainedPercent)}%`} />
            <Metric label="Wording replaced" value={`${Math.round(result.receipt.wordingReplacedPercent)}%`} />
            <Metric label="Longest unprotected" value={`${result.receipt.longestUnprotectedSharedWordRun} words`} />
          </div>

          <div className="clean-output transform-output">
            <div className="output-heading">
              <strong>Revised prose</strong>
              <div className="actions inline-actions">
                <button className="copy" onClick={copyResult}>Copy</button>
                <button className="copy" onClick={adoptResult}>Use as source</button>
                <button className="copy" onClick={() => setDiffOpen((value) => !value)}>{diffOpen ? "Hide semantic diff" : "Inspect semantic diff"}</button>
              </div>
            </div>
            <pre>{result.text}</pre>
            <p>{result.model} · {result.attempts} attempt{result.attempts === 1 ? "" : "s"} · {result.metrics.sourceWords} → {result.metrics.outputWords} words</p>
          </div>

          {diffOpen && <SemanticDiffViewer source={text} output={result.text} result={result} />}

          <div className="verification-box">
            <strong>Deterministic preservation receipt</strong>
            <div className="verification-stats">
              <span>facts/entities {result.receipt.checks.numericDateEntityPreserved}/{result.receipt.checks.numericDateEntityExpected}</span>
              <span>quotes/refs {result.receipt.checks.quoteReferencePreserved}/{result.receipt.checks.quoteReferenceExpected}</span>
              <span>{result.receipt.protectedSpanCount} protected spans</span>
            </div>
            <p>Text-watermark verifier: {result.watermark.available ? result.watermark.status : "unavailable"}. {result.watermark.note}</p>
          </div>

          {result.billing && <div className="verification-box billing-receipt">
            <strong>Usage state</strong>
            <div className="credit-state-timeline" aria-label="Usage hold timeline">
              <span className="done">reserved</span><i aria-hidden="true">→</i><span className="done">verified</span><i aria-hidden="true">→</i><span className="done">committed</span>
            </div>
            <div className="verification-stats">
              <span>{result.billing.creditsCharged} unit{result.billing.creditsCharged === 1 ? "" : "s"} committed</span>
              <span>{result.billing.balanceAfter} remaining</span>
              <span className="mono-label">operation {result.billing.operationId.slice(0, 8)}</span>
            </div>
            <p>The debit was committed only after preservation validation passed.</p>
          </div>}

          {result.warnings.length > 0 && <div className="notice-card"><strong>Review note</strong><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}

          <div className="honesty-note">
            <span className="mono-label">VALIDATION SCOPE</span>
            <p><strong>Validated</strong> means preservation checks passed. It does not prove human authorship, guarantee detector evasion, or remove a statistical watermark.</p>
          </div>

          <div className="receipt-tools">
            <button className="ghost" onClick={() => downloadReceipt(result)}>Export JSON receipt</button>
            {result.billing && <button className="ghost" onClick={() => publishResult(result)}>View receipt</button>}
          </div>
        </>}
      </div>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
