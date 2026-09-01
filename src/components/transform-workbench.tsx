"use client";

import { useCallback, useMemo, useState } from "react";
import { countWords, creditCostForText, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import type { TransformMode, TransformResult } from "@/lib/transform";
import { TurnstileWidget } from "./turnstile-widget";

const MODES: Array<{ id: TransformMode; label: string; description: string }> = [
  { id: "natural", label: "Natural", description: "Improve flow while retaining the apparent voice." },
  { id: "clarity", label: "Clarity", description: "Make wording and structure easier to follow." },
  { id: "concise", label: "Concise", description: "Reduce repetition without dropping facts or qualifiers." },
  { id: "formal", label: "Formal", description: "Polish the prose for a professional setting." },
];
function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
    if (typeof error === "string") return error;
  }
  return fallback;
}

export function TransformWorkbench() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<TransformMode>("natural");
  const [result, setResult] = useState<TransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const onChallenge = useCallback((token: string | null) => setChallengeToken(token), []);
  const selectedMode = useMemo(() => MODES.find(item => item.id === mode)!, [mode]);
  const words = useMemo(() => countWords(text), [text]);
  const estimatedCredits = useMemo(() => creditCostForText(text), [text]);
  const overLimit = words > MAX_REWRITE_WORDS;

  async function transform() {
    if (!challengeToken || overLimit) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/transform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), text, mode, challengeToken }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(messageFrom(payload, "The edit could not be completed."));
      setResult(payload as TransformResult);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The edit could not be completed."); }
    finally { setBusy(false); setChallengeToken(null); setChallengeReset(value => value + 1); }
  }

  async function copyResult() { if (result) await navigator.clipboard.writeText(result.text); }
  return <section className="transform-section" aria-label="Semantics-preserving editor">
    <div className="section-heading"><div><p className="eyebrow">Protected semantic editing</p><h2>Edit the prose. Keep the facts.</h2><p>Protected spans and deterministic validation sit around the language model. Each operation accepts up to {MAX_REWRITE_WORDS.toLocaleString()} words and commits credits only after the edit passes preservation checks.</p></div><span className="pill">~{estimatedCredits} credit{estimatedCredits === 1 ? "" : "s"}</span></div>
    <div className="transform-grid"><div className="panel transform-input-panel">
      <div className="panel-heading"><div><p className="eyebrow">Source</p><h2>Choose an editing goal</h2></div><span className={`pill ${overLimit ? "warn" : ""}`}>{words.toLocaleString()} / {MAX_REWRITE_WORDS.toLocaleString()} words</span></div>
      <div className="mode-row" role="group" aria-label="Editing mode">{MODES.map(item => <button key={item.id} type="button" className={`mode-button ${mode === item.id ? "active" : ""}`} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
      <p className="mode-description">{selectedMode.description}</p>
      <textarea value={text} maxLength={250_000} placeholder="Paste prose you want to edit…" onChange={event => setText(event.target.value)} />
      {overLimit && <div className="error-card">This edit is {words.toLocaleString()} words. Split it into parts of at most {MAX_REWRITE_WORDS.toLocaleString()} words.</div>}
      <TurnstileWidget action="transform" onToken={onChallenge} resetKey={challengeReset} />
      <div className="actions"><button className="primary" disabled={busy || text.trim().length < 20 || overLimit || !challengeToken} onClick={transform}>{busy ? "Validating edit…" : `Edit for ${selectedMode.label.toLowerCase()}`}</button><button className="ghost" disabled={busy || !text} onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</button></div>
      <p className="privacy-note">Text stays local until you explicitly run an edit. Raw source/result text is not intentionally persisted or written to operational logs.</p>{error && <div className="error-card">{error}</div>}
    </div><div className="panel transform-output-panel">
      <div className="panel-heading"><div><p className="eyebrow">Validated output</p><h2>{result ? "Edit passed preservation checks" : "Ready when you are"}</h2></div>{result && <span className="score ok">Validated</span>}</div>
      {!result ? <div className="empty-state compact">Run an edit to see the revised prose, deterministic receipt, and committed credit charge.</div> : <><div className="transform-metrics"><Metric label="Protected" value={`${result.metrics.protectedPreserved}/${result.metrics.protectedTotal}`} /><Metric label="Length retained" value={`${Math.round(result.metrics.lengthRatio * 100)}%`} /><Metric label="Longest shared" value={`${result.metrics.longestSharedWordRun} words`} /><Metric label="3-gram overlap" value={`${Math.round(result.metrics.trigramOverlap * 100)}%`} /></div><div className="clean-output transform-output"><div className="output-heading"><strong>Revised prose</strong><button className="copy" onClick={copyResult}>Copy</button></div><pre>{result.text}</pre><p>{result.model} · {result.attempts} attempt{result.attempts === 1 ? "" : "s"} · {result.metrics.sourceWords} → {result.metrics.outputWords} words</p></div>{result.billing && <div className="verification-box"><strong>Billing receipt</strong><div className="verification-stats"><span>{result.billing.creditsCharged} credit{result.billing.creditsCharged === 1 ? "" : "s"} charged</span><span>{result.billing.balanceAfter} remaining</span><span>operation {result.billing.operationId.slice(0, 8)}</span></div><p>The debit was committed only after preservation validation passed.</p></div>}{result.warnings.length > 0 && <div className="notice-card"><strong>Review note</strong><ul>{result.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}<div className="verification-box"><strong>What “validated” means here</strong><p>Protected factual spans survived exactly and deterministic checks passed. It does not prove human authorship or detector performance.</p></div></>}
    </div></div>
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
