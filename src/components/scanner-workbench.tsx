"use client";

import { useCallback, useMemo, useState } from "react";
import type { SanitizeReceipt, TextScanReceipt } from "@/lib/provenance/types";
import { sanitizeText, scanText } from "@/lib/provenance/unicode";
import { TurnstileWidget } from "./turnstile-widget";

const DEMO_TEXT = "A normal sentence\u200B with a hidden zero-width space.\nRTL control example: \u202Ereview me.";

export function ScannerWorkbench() {
  const [text, setText] = useState(DEMO_TEXT);
  const [receipt, setReceipt] = useState<TextScanReceipt | null>(null);
  const [sanitation, setSanitation] = useState<SanitizeReceipt | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeReset, setChallengeReset] = useState(0);
  const onChallenge = useCallback((token: string | null) => setChallengeToken(token), []);
  const canScan = text.length > 0;

  const grouped = useMemo(() => {
    if (!receipt) return [];
    return Object.entries(receipt.summary.byCategory).filter(([, count]) => count > 0);
  }, [receipt]);

  function replaceText(next: string, sourceFile: string | null = null) {
    setText(next);
    setFileName(sourceFile);
    setReceipt(null);
    setSanitation(null);
    setError(null);
  }

  async function loadTxt(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
      setError("Choose a plain-text .txt file.");
      return;
    }
    try { replaceText(await file.text(), file.name); }
    catch { setError("Could not read this text file."); }
  }

  function runScan() {
    setReceipt(scanText(text));
    setSanitation(null);
  }

  async function cleanConservatively() {
    if (!challengeToken || !canScan) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeToken, forClean: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Could not prepare the clean operation.");
      const next = sanitizeText(text, "conservative");
      setSanitation(next);
      setReceipt(scanText(next.output));
      window.dispatchEvent(new Event("provenance:account-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clean this text.");
    } finally {
      setBusy(false);
      setChallengeToken(null);
      setChallengeReset(value => value + 1);
    }
  }

  return (
    <section className="workbench" aria-label="Provenance text scanner">
      <div className="panel editor-panel">
        <div className="panel-heading"><div><p className="eyebrow">Free text scanner</p><h2>Inspect before you clean.</h2></div><span className="pill">scan: 0 credits · no account</span></div>
        <div className="actions">
          <label className="secondary" style={{ cursor: "pointer" }}>Upload .txt<input type="file" accept=".txt,text/plain" hidden onChange={event => void loadTxt(event.target.files?.[0] ?? null)} /></label>
          <button className="ghost" onClick={() => replaceText(DEMO_TEXT)}>Try example</button>
          {fileName && <span className="pill">{fileName}</span>}
        </div>
        <textarea value={text} onChange={(event) => replaceText(event.target.value)} spellCheck={false} aria-label="Text to scan" />
        <div className="actions">
          <button className="primary" onClick={runScan} disabled={!canScan}>Scan text — free</button>
          <button className="secondary" onClick={() => void cleanConservatively()} disabled={!canScan || busy || !challengeToken}>{busy ? "Preparing clean…" : "Clean safe findings"}</button>
          <button className="ghost" onClick={() => replaceText("")}>Clear</button>
        </div>
        <TurnstileWidget action="account" onToken={onChallenge} resetKey={challengeReset} />
        <p className="privacy-note">Scanning is free and local. The first signed-out clean lazily creates a guest account and grants the one-time guest promotion; the text itself remains in your browser.</p>
        {error && <div className="error-card">{error}</div>}
      </div>

      <div className="panel receipt-panel">
        <div className="panel-heading"><div><p className="eyebrow">Verification receipt</p><h2>{receipt ? `${receipt.summary.total} finding${receipt.summary.total === 1 ? "" : "s"}` : "Ready to scan"}</h2></div>{receipt && <span className={`score ${receipt.summary.reviewRequired ? "warn" : "ok"}`}>{receipt.summary.reviewRequired ? "Review" : "Clean"}</span>}</div>
        {!receipt ? <div className="empty-state">Paste text or upload a .txt file and run a scan to see exact code points, locations, and removal safety.</div> : <>
          <div className="metrics"><Metric label="Words" value={receipt.input.words} /><Metric label="Safe removals" value={receipt.summary.safeToRemove} /><Metric label="Needs review" value={receipt.summary.reviewRequired} /></div>
          {grouped.length > 0 && <div className="category-row">{grouped.map(([category, count]) => <span className="category" key={category}>{category.replaceAll("_", " ")} · {count}</span>)}</div>}
          <div className="findings">{receipt.findings.length === 0 ? <div className="success-card">No tracked hidden or unusual Unicode characters found.</div> : receipt.findings.map((finding) => <article className="finding" key={finding.id}><div><strong>{finding.codePoint} · {finding.characterName}</strong><p>{finding.description}</p><small>index {finding.index}</small></div><span className={finding.disposition === "safe_remove" ? "tag-safe" : "tag-review"}>{finding.disposition === "safe_remove" ? "safe remove" : "review"}</span></article>)}</div>
        </>}
        {sanitation && <div className="clean-output"><div className="output-heading"><strong>Conservative cleaned output</strong><button className="copy" onClick={() => navigator.clipboard.writeText(sanitation.output)}>Copy</button></div><pre>{sanitation.output || "(empty)"}</pre><p>{sanitation.removed.length} removed · {sanitation.preservedForReview.length} preserved for review · post-clean scan {scanText(sanitation.output).summary.total === 0 ? "clear" : "requires review"}</p></div>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
