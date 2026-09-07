"use client";

import { useMemo, useRef, useState } from "react";
import type { TextFinding } from "@/lib/provenance/types";
import { prepareProtectedText } from "@/lib/transform";
import type { ProtectedSpan, TransformResult } from "@/lib/transform";

type DiffMode = "simple" | "detailed" | "protected";

function findingTone(finding: TextFinding) {
  return finding.disposition === "safe_remove" ? "safe" : "review";
}

function findingLabel(finding: TextFinding) {
  return finding.disposition === "safe_remove" ? "safe remove" : "needs review";
}

function codePointWidth(codePoint: string) {
  const value = Number.parseInt(codePoint.replace(/^U\+/i, ""), 16);
  return Number.isFinite(value) && value > 0xffff ? 2 : 1;
}

function sourceContext(text: string, finding: TextFinding) {
  const radius = 72;
  const start = Math.max(0, finding.index - radius);
  const width = codePointWidth(finding.codePoint);
  const end = Math.min(text.length, finding.index + width + radius);
  return {
    prefix: start > 0 ? "…" : "",
    suffix: end < text.length ? "…" : "",
    before: text.slice(start, finding.index),
    after: text.slice(finding.index + width, end),
  };
}

export function ForensicTextPreview({ text, findings }: { text: string; findings: TextFinding[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selected = findings.find((finding) => finding.id === selectedId) ?? findings[0] ?? null;
  const context = selected ? sourceContext(text, selected) : null;

  function selectFinding(id: string, scroll = false) {
    setSelectedId(id);
    if (scroll) {
      window.requestAnimationFrame(() => {
        rowRefs.current[id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }

  if (findings.length === 0) {
    return <div className="success-card">No tracked hidden or unusual Unicode characters found.</div>;
  }

  return <div className="forensic-explorer" data-testid="forensic-text-explorer">
    <div className="forensic-preview" aria-live="polite" aria-label="Selected finding source preview">
      <div className="forensic-preview-head">
        <div>
          <span className="mono-label">SOURCE LOCATION</span>
          <strong>{selected ? `Index ${selected.index}` : "No finding selected"}</strong>
        </div>
        {selected && <span className={`finding-state ${findingTone(selected)}`}>{findingLabel(selected)}</span>}
      </div>
      {selected && context && <div className="source-snippet">
        <span>{context.prefix}{context.before}</span>
        <mark className={`source-signal ${findingTone(selected)}`} aria-label={`${selected.codePoint} ${selected.characterName}`}>
          [{selected.codePoint}]
        </mark>
        <span>{context.after}{context.suffix}</span>
      </div>}
      {selected && <div className="forensic-preview-meta">
        <span>{selected.codePoint}</span>
        <span>{selected.characterName}</span>
        <span>{selected.category.replaceAll("_", " ")}</span>
      </div>}
    </div>

    <div className="signal-map interactive" aria-label="Document location map">
      <div className="signal-track">
        {findings.map((finding) => <button
          type="button"
          key={finding.id}
          className={`${findingTone(finding)} ${finding.id === selected?.id ? "selected" : ""}`}
          style={{ left: `${Math.min(99, Math.max(1, (finding.index / Math.max(1, text.length)) * 100))}%` }}
          aria-label={`Select ${finding.codePoint} at index ${finding.index}`}
          aria-pressed={finding.id === selected?.id}
          onClick={() => selectFinding(finding.id, true)}
          title={`${finding.codePoint} at index ${finding.index}`}
        />)}
      </div>
      <div className="signal-map-labels">
        <span>start</span>
        <strong>{findings.length} signal{findings.length === 1 ? "" : "s"} mapped</strong>
        <span>end</span>
      </div>
    </div>

    <div className="forensic-findings" aria-label="Unicode findings">
      {findings.map((finding) => <button
        type="button"
        key={finding.id}
        ref={(node) => { rowRefs.current[finding.id] = node; }}
        className={`forensic-finding-row ${finding.id === selected?.id ? "selected" : ""}`}
        aria-pressed={finding.id === selected?.id}
        onClick={() => selectFinding(finding.id)}
      >
        <span className="finding-primary">
          <span className="finding-code">{finding.codePoint}</span>
          <span>
            <strong>{finding.characterName}</strong>
            <small>index {finding.index} · {finding.category.replaceAll("_", " ")}</small>
          </span>
        </span>
        <span className="finding-description">{finding.description}</span>
        <span className={`finding-state ${findingTone(finding)}`}>{findingLabel(finding)}</span>
      </button>)}
    </div>
  </div>;
}

function normalizedToken(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function visualTokens(value: string, comparison: string, tone: "removed" | "added", detailed: boolean) {
  const comparisonWords = new Set(
    (comparison.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [])
      .map(normalizedToken)
      .filter(Boolean),
  );
  const parts = value.split(/(\s+|[.,!?;:()[\]{}"“”])/u);
  return parts.map((part, index) => {
    const normalized = normalizedToken(part);
    const changed = Boolean(normalized) && !comparisonWords.has(normalized);
    if (!changed) return <span key={`${index}-${part}`}>{part}</span>;
    return <mark key={`${index}-${part}`} className={`diff-token ${tone} ${detailed ? "detailed" : ""}`}>{part}</mark>;
  });
}

function preservedStatus(span: ProtectedSpan, output: string) {
  if (output.includes(span.value)) return "preserved";
  const normalizedValue = span.value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const normalizedOutput = output.replace(/\s+/g, " ").toLocaleLowerCase();
  if (normalizedValue && normalizedOutput.includes(normalizedValue)) return "changed";
  return "needs review";
}

function displayedOutputValue(span: ProtectedSpan, output: string) {
  const status = preservedStatus(span, output);
  if (status === "preserved") return span.value;
  if (status === "changed") return "Present with normalized formatting";
  return "Not located by visual comparison";
}

export function SemanticDiffViewer({
  source,
  output,
  result,
}: {
  source: string;
  output: string;
  result: TransformResult;
}) {
  const [mode, setMode] = useState<DiffMode>("simple");
  const spans = useMemo(() => prepareProtectedText(source).spans, [source]);
  const visibleSpans = spans.slice(0, 24);
  const hiddenCount = Math.max(0, spans.length - visibleSpans.length);

  return <section className="semantic-diff-viewer" aria-label="Semantic diff viewer">
    <div className="semantic-diff-head">
      <div>
        <span className="mono-label">SEMANTIC DIFF</span>
        <strong>See wording changes without losing the preservation evidence.</strong>
      </div>
      <div className="diff-tabs" role="group" aria-label="Semantic diff level">
        {(["simple", "detailed", "protected"] as const).map((item) => <button
          key={item}
          type="button"
          aria-pressed={mode === item}
          className={mode === item ? "active" : ""}
          onClick={() => setMode(item)}
        >
          {item === "protected" ? "Protected facts" : item[0].toUpperCase() + item.slice(1)}
        </button>)}
      </div>
    </div>

    {mode !== "protected" && <>
      {mode === "detailed" && <div className="diff-legend" aria-label="Diff legend">
        <span><i className="removed" />Removed wording</span>
        <span><i className="added" />New wording</span>
        <span><i className="protected" />Protected evidence</span>
      </div>}
      <div className="semantic-compare refined">
        <div>
          <span className="mono-label">SOURCE</span>
          <p>{visualTokens(source, output, "removed", mode === "detailed")}</p>
        </div>
        <div>
          <span className="mono-label">OUTPUT</span>
          <p>{visualTokens(output, source, "added", mode === "detailed")}</p>
        </div>
        <small>Highlights are a visual wording aid. The deterministic preservation receipt remains authoritative.</small>
      </div>
      <div className="semantic-summary-strip">
        <span><strong>{Math.round(result.receipt.wordingReplacedPercent)}%</strong> wording replaced</span>
        <span><strong>{Math.round(result.receipt.retainedPercent)}%</strong> length retained</span>
        <span><strong>{result.metrics.protectedPreserved}/{result.metrics.protectedTotal}</strong> protected spans</span>
      </div>
    </>}

    {mode === "protected" && <div className="protected-facts-view">
      <div className="protected-facts-summary">
        <span><strong>{result.receipt.checks.numericDateEntityPreserved}/{result.receipt.checks.numericDateEntityExpected}</strong> facts / entities</span>
        <span><strong>{result.receipt.checks.quoteReferencePreserved}/{result.receipt.checks.quoteReferenceExpected}</strong> quotes / references</span>
        <span><strong>{result.receipt.protectedSpanCount}</strong> deterministic spans</span>
      </div>
      {visibleSpans.length === 0 ? <div className="empty-state compact">
        <div><span className="empty-symbol">✓</span><strong>No protected literals were detected</strong><p>The edit still passed the other deterministic preservation checks shown in the receipt.</p></div>
      </div> : <div className="protected-table" role="table" aria-label="Protected facts preservation table">
        <div className="protected-table-head" role="row">
          <span role="columnheader">Protected item</span>
          <span role="columnheader">Source value</span>
          <span role="columnheader">Output value</span>
          <span role="columnheader">Status</span>
        </div>
        {visibleSpans.map((span) => {
          const status = preservedStatus(span, output);
          return <div className="protected-table-row" role="row" key={`${span.id}-${span.start}`}>
            <span role="cell" className="protected-kind">{span.kind}</span>
            <span role="cell" title={span.value}>{span.value}</span>
            <span role="cell" title={displayedOutputValue(span, output)}>{displayedOutputValue(span, output)}</span>
            <span role="cell"><span className={`preservation-status ${status.replace(" ", "-")}`}>{status}</span></span>
          </div>;
        })}
        {hiddenCount > 0 && <div className="protected-table-more">+ {hiddenCount} additional protected item{hiddenCount === 1 ? "" : "s"} included in validation.</div>}
      </div>}
      <p className="diff-authority-note">This table is generated from the same deterministic protected-span extractor used by the edit pipeline. The server-side validation result is the final authority.</p>
    </div>}
  </section>;
}

export function OperationStatus({
  state,
  message,
}: {
  state: "idle" | "working" | "complete" | "review";
  message: string;
}) {
  return <div className={`operation-status ${state}`} role="status">
    <span aria-hidden="true" />
    <strong>{message}</strong>
  </div>;
}
