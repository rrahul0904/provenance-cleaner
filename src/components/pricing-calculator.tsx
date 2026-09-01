"use client";

import { useMemo, useState } from "react";
import { creditCostForWords } from "@/lib/product-contract";

const PRESETS = [
  { label: "Short document", words: 1_000 },
  { label: "Medium paper", words: 5_000 },
  { label: "Long chapter", words: 10_000 },
];

export function PricingCalculator() {
  const [words, setWords] = useState(5_000);
  const credits = useMemo(() => creditCostForWords(words), [words]);
  const promoCovered = credits <= 5;
  return <section className="panel" aria-labelledby="pricing-calculator-title">
    <div className="panel-heading"><div><p className="eyebrow">Credit calculator</p><h2 id="pricing-calculator-title">Estimate a text job</h2></div><span className="pill">{credits} credit{credits === 1 ? "" : "s"}</span></div>
    <label>
      <strong>Word count</strong>
      <input type="number" min={1} max={100_000} step={100} value={words} onChange={event => setWords(Math.max(1, Math.min(100_000, Number(event.target.value) || 1)))} />
    </label>
    <input aria-label="Word count slider" type="range" min={500} max={100_000} step={500} value={Math.max(500, words)} onChange={event => setWords(Number(event.target.value))} />
    <div className="actions">{PRESETS.map(preset => <button type="button" className="ghost" key={preset.label} onClick={() => setWords(preset.words)}>{preset.label}</button>)}</div>
    <div className="verification-box"><strong>{words.toLocaleString()} words → {credits} credit{credits === 1 ? "" : "s"}</strong><p>Text uses one credit per 1,000 source words, rounded up. {promoCovered ? "The full five-credit first-time allowance could cover this job." : "This job needs more than the five-credit first-time allowance."}</p></div>
  </section>;
}
