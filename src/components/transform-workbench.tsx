"use client";

import { useMemo, useState } from "react";
import type { TransformMode, TransformResult } from "@/lib/transform";

const MODES: Array<{ id: TransformMode; label: string; description: string }> = [
  { id: "natural", label: "Natural", description: "Improve flow while retaining the apparent voice." },
  { id: "clarity", label: "Clarity", description: "Make wording and structure easier to follow." },
  { id: "concise", label: "Concise", description: "Reduce repetition without dropping facts or qualifiers." },
  { id: "formal", label: "Formal", description: "Polish the prose for a professional setting." },
];

export function TransformWorkbench() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<TransformMode>("natural");
  const [result, setResult] = useState<TransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedMode = useMemo(() => MODES.find((item) => item.id === mode)!, [mode]);

  async function transform() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/transform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, mode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The edit could not be completed.");
      setResult(payload as TransformResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The edit could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    if (result) await navigator.clipboard.writeText(result.text);
  }

  return (
    <section className="transform-section" aria-label="Semantics-preserving editor">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Phase 3 · semantic editing</p>
          <h2>Edit the prose. Keep the facts.</h2>
          <p>Protected spans and deterministic validation sit around the language model so dates, numbers, links, citations, quoted text, and inline code are not casually rewritten.</p>
        </div>
        <span className="pill">12k character limit</span>
      </div>

      <div className="transform-grid">
        <div className="panel transform-input-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Source</p>
              <h2>Choose an editing goal</h2>
            </div>
            <span className="pill">{text.length.toLocaleString()} / 12,000</span>
          </div>

          <div className="mode-row" role="group" aria-label="Editing mode">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mode-button ${mode === item.id ? "active" : ""}`}
                onClick={() => setMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mode-description">{selectedMode.description}</p>

          <textarea
            value={text}
            maxLength={12_000}
            placeholder="Paste prose you want to edit…"
            onChange={(event) => setText(event.target.value)}
          />
          <div className="actions">
            <button className="primary" disabled={busy || text.trim().length < 20} onClick={transform}>
              {busy ? "Validating edit…" : `Edit for ${selectedMode.label.toLowerCase()}`}
            </button>
            <button className="ghost" disabled={busy || !text} onClick={() => { setText(""); setResult(null); setError(null); }}>
              Clear
            </button>
          </div>
          <p className="privacy-note">Text stays local until you explicitly run an edit. That action sends the protected prose to the configured Vercel AI Gateway model; the app does not persist the source or result in Phase 3.</p>
          {error && <div className="error-card">{error}</div>}
        </div>

        <div className="panel transform-output-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Validated output</p>
              <h2>{result ? "Edit passed preservation checks" : "Ready when you are"}</h2>
            </div>
            {result && <span className="score ok">Validated</span>}
          </div>

          {!result ? (
            <div className="empty-state compact">Run an edit to see the revised prose, protected-span coverage, length change, and phrase-overlap receipt.</div>
          ) : (
            <>
              <div className="transform-metrics">
                <Metric label="Protected" value={`${result.metrics.protectedPreserved}/${result.metrics.protectedTotal}`} />
                <Metric label="Length" value={`${Math.round(result.metrics.lengthRatio * 100)}%`} />
                <Metric label="Longest shared" value={`${result.metrics.longestSharedWordRun} words`} />
                <Metric label="3-gram overlap" value={`${Math.round(result.metrics.trigramOverlap * 100)}%`} />
              </div>

              <div className="clean-output transform-output">
                <div className="output-heading">
                  <strong>Revised prose</strong>
                  <button className="copy" onClick={copyResult}>Copy</button>
                </div>
                <pre>{result.text}</pre>
                <p>{result.model} · {result.attempts} generation attempt{result.attempts === 1 ? "" : "s"} · {result.metrics.sourceWords} → {result.metrics.outputWords} words</p>
              </div>

              {result.warnings.length > 0 && (
                <div className="notice-card">
                  <strong>Review note</strong>
                  <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </div>
              )}
              <div className="verification-box">
                <strong>What “validated” means here</strong>
                <p>Protected factual spans survived exactly and deterministic length/invariant checks passed. It is an editing receipt, not a claim that the prose is “human-written,” detector-proof, or provenance-free.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
