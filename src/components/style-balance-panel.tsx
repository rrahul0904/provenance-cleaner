"use client";

import { useState } from "react";
import { calibrateWriterStyle, createSyntheticStyleProfile, measureStyleBalance, STYLE_METRICS, type StyleBalanceComparison, type StyleMeasurement } from "@/lib/style-balance-meter";

const LABELS = { sentenceWords: "Words per sentence", sentenceVariation: "Sentence length variation", paragraphWords: "Words per paragraph", headingDensity: "Heading share", listDensity: "List share", questionRate: "Question share", firstPersonRate: "First person share", contractionRate: "Apostrophe word share", commaRate: "Commas per word", semicolonRate: "Semicolons per word", parenthesisRate: "Parentheses per word", dashRate: "Dashes per word", lexicalDiversity: "Vocabulary diversity" };
export function StyleBalancePanel({ text, comparison, writerSample, onWriterSample, disabled }: { text: string; comparison?: StyleBalanceComparison; writerSample: string; onWriterSample: (sample: string) => void; disabled: boolean }) {
  const [local, setLocal] = useState<{ text: string; sample: string; result: StyleMeasurement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const measured = local?.text === text && local.sample === writerSample ? local.result : null;
  const before = comparison?.before ?? measured;
  async function measure() {
    setBusy(true); setError(null);
    try {
      const context = { userId: "local-browser", sessionId: crypto.randomUUID(), now: Date.now() };
      const profile = writerSample.trim() ? await calibrateWriterStyle(writerSample, context) : await createSyntheticStyleProfile();
      setLocal({ text, sample: writerSample, result: await measureStyleBalance(text, profile, context) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Style measurement failed."); }
    finally { setBusy(false); }
  }
  return <details className="verification-box">
    <summary>Style balance · local measurements</summary>
    <p>Describes writing structure against a small synthetic reference or your sample. These measurements do not determine authorship. At least 48 words and 4 sentence/line units are required.</p>
    <label htmlFor="style-writer-sample">Optional writing sample</label>
    <textarea id="style-writer-sample" value={writerSample} disabled={disabled || busy} maxLength={40_000} onChange={event => { setError(null); onWriterSample(event.target.value); }} placeholder="Paste your own writing to compare its structure. The sample is used for this request and is not saved." />
    <p>Without a sample, the reference uses independently authored synthetic examples. Local measurement stays in this browser. Running a semantic edit sends the sample with the edit request.</p>
    <button type="button" className="ghost" onClick={measure} disabled={disabled || busy || !text.trim()}>{busy ? "Measuring…" : "Measure source locally"}</button>
    <div aria-live="polite">
      {error && <p role="alert">{error}</p>}
      {before?.reason && <p>{before.reason}</p>}
      {comparison?.after.reason && <p>After edit: {comparison.after.reason}</p>}
      {before && <div style={{ overflowX: "auto" }}><table><caption>Style measurements · {before.meterVersion}</caption><thead><tr><th scope="col">Metric</th><th scope="col">Source</th>{comparison && <th scope="col">Edited</th>}<th scope="col">Range result</th></tr></thead><tbody>
        {STYLE_METRICS.map(key => <tr key={key}><th scope="row">{LABELS[key]}</th><td>{before.metrics[key].value?.toFixed(3) ?? "—"}</td>{comparison && <td>{comparison.after.metrics[key].value?.toFixed(3) ?? "—"}</td>}<td>{(comparison?.after ?? before).metrics[key].state.replaceAll("_", " ").toLowerCase()}</td></tr>)}
      </tbody></table></div>}
      {comparison?.warnings.map(warning => <p key={warning}>{warning}</p>)}
      {!!comparison?.overshoot.length && <p>Crossed reference band: {comparison.overshoot.map(key => LABELS[key]).join(", ")}</p>}
      {comparison && <p>Receipt: {comparison.receipt.version} · profile {comparison.profileId}/{comparison.profileVersion}. Hashes are included in the exported edit receipt.</p>}
    </div>
  </details>;
}
