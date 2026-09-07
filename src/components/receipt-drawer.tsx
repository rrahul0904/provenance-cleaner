"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ReceiptStatus = "clean" | "review" | "validated" | "blocked" | "pending" | "released" | "refunded" | "inspected";

export type ReceiptDetail = {
  id: string;
  title: string;
  operation: string;
  status: ReceiptStatus;
  timestamp?: string;
  accountState?: string;
  creditsReserved?: number;
  creditsCommitted?: number;
  creditsReleased?: number;
  inputSizeBucket?: string;
  originalHash?: string;
  outputHash?: string;
  findingsDetected?: number;
  findingsRemoved?: number;
  findingsPreserved?: number;
  findingsReview?: number;
  verification?: string;
  details?: Array<{ label: string; value: string | number }>;
  notes?: string[];
};

export function emitReceipt(detail: ReceiptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReceiptDetail>("provenance:receipt", {
    detail: { ...detail, timestamp: detail.timestamp ?? new Date().toISOString() },
  }));
}

function downloadReceipt(receipt: ReceiptDetail) {
  const blob = new Blob([JSON.stringify({ version: "ui-receipt-v2", ...receipt }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `provenance-receipt-${receipt.id.slice(0, 12)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function humanStatus(receipt: ReceiptDetail) {
  switch (receipt.status) {
    case "validated":
      return "Verified. The output passed the operation’s validation checks.";
    case "review":
      return "Inspection complete. Some evidence still needs review.";
    case "blocked":
      return "Action blocked so integrity-sensitive evidence is not silently damaged.";
    case "released":
      return "Validation did not complete, so the credit hold was released.";
    case "refunded":
      return "The billing event was reconciled and the eligible amount was refunded.";
    case "pending":
      return "The operation is recorded, but final reconciliation is still pending.";
    case "clean":
      return "Inspection complete. No tracked issue requires action.";
    default:
      return "Inspection complete. Evidence is ready to review.";
  }
}

function timelineFor(receipt: ReceiptDetail) {
  if (receipt.status === "released") return ["Inspect", "Reserve", "Validation failed", "Credits released"];
  if (receipt.status === "refunded") return ["Inspect", "Commit", "Reconcile", "Refunded"];
  if (receipt.status === "blocked") return ["Inspect", "Classify", "Blocked", "Receipt"];
  if (/\.(scan|inspect|verify)$/.test(receipt.operation) || receipt.operation === "file.inspect") {
    return ["Inspect", "Classify", "Verify", "Receipt"];
  }
  return ["Inspect", "Classify", "Act", "Verify", "Receipt"];
}

export function ReceiptDrawer() {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onReceipt = (event: Event) => {
      const detail = (event as CustomEvent<ReceiptDetail>).detail;
      if (!detail?.id || !detail?.operation) return;
      setReceipt(detail);
    };
    window.addEventListener("provenance:receipt", onReceipt);
    return () => window.removeEventListener("provenance:receipt", onReceipt);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const timeline = useMemo(() => receipt ? timelineFor(receipt) : [], [receipt]);
  if (!receipt) return null;

  const detected = receipt.findingsDetected ?? (
    typeof receipt.findingsRemoved === "number" || typeof receipt.findingsPreserved === "number"
      ? (receipt.findingsRemoved ?? 0) + (receipt.findingsPreserved ?? 0)
      : undefined
  );

  function closeDrawer() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="receipt-fab"
      onClick={() => setOpen(true)}
      aria-label="View latest verification receipt"
    >
      <span className="status-dot"/>View receipt
    </button>

    {open && <div className="receipt-overlay" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) closeDrawer();
    }}>
      <aside className="receipt-drawer" role="dialog" aria-modal="true" aria-labelledby="receipt-drawer-title" aria-describedby="receipt-status-copy">
        <div className="receipt-drawer-grabber" aria-hidden="true" />
        <div className="receipt-drawer-head">
          <div><p className="eyebrow">Forensic ledger</p><h2 id="receipt-drawer-title">{receipt.title}</h2></div>
          <button ref={closeRef} className="icon-button" type="button" onClick={closeDrawer} aria-label="Close receipt">×</button>
        </div>

        <div className="receipt-status-summary">
          <div className="receipt-status-row">
            <span className={`receipt-status ${receipt.status}`}>{receipt.status}</span>
            <span className="mono-label">{receipt.operation}</span>
          </div>
          <p id="receipt-status-copy">{humanStatus(receipt)}</p>
        </div>

        <div className="receipt-timeline refined" aria-label="Receipt timeline">
          {timeline.map((stage, index) => <div className={receipt.status === "pending" && index === timeline.length - 1 ? "" : "active"} key={stage}>
            <span aria-hidden="true"/><strong>{stage}</strong>
          </div>)}
        </div>

        <div className="receipt-glance-grid" aria-label="Receipt summary">
          {typeof detected === "number" && <div><span>Detected</span><strong>{detected}</strong></div>}
          {typeof receipt.findingsRemoved === "number" && <div><span>Removed</span><strong>{receipt.findingsRemoved}</strong></div>}
          {typeof receipt.findingsPreserved === "number" && <div><span>Preserved</span><strong>{receipt.findingsPreserved}</strong></div>}
          {typeof receipt.findingsReview === "number" && <div><span>Review</span><strong>{receipt.findingsReview}</strong></div>}
          {typeof receipt.creditsCommitted === "number" && <div><span>Committed</span><strong>{receipt.creditsCommitted}</strong></div>}
          {typeof receipt.creditsReleased === "number" && <div><span>Released</span><strong>{receipt.creditsReleased}</strong></div>}
        </div>

        <dl className="receipt-ledger receipt-ledger-primary">
          <div><dt>Operation ID</dt><dd className="mono-label">{receipt.id}</dd></div>
          <div><dt>Timestamp</dt><dd>{receipt.timestamp ? new Date(receipt.timestamp).toLocaleString() : "Now"}</dd></div>
          {receipt.accountState && <div><dt>Account</dt><dd>{receipt.accountState}</dd></div>}
          {receipt.inputSizeBucket && <div><dt>Input size</dt><dd>{receipt.inputSizeBucket}</dd></div>}
        </dl>

        {(receipt.verification || typeof receipt.creditsReserved === "number" || typeof receipt.creditsCommitted === "number" || typeof receipt.creditsReleased === "number") && <div className="verification-box receipt-verification">
          <strong>Verification & credit state</strong>
          {receipt.verification && <p>{receipt.verification}</p>}
          {(typeof receipt.creditsReserved === "number" || typeof receipt.creditsCommitted === "number" || typeof receipt.creditsReleased === "number") && <div className="credit-state-timeline" aria-label="Receipt credit state">
            {typeof receipt.creditsReserved === "number" && <span className="done">reserved {receipt.creditsReserved}</span>}
            {typeof receipt.creditsCommitted === "number" && <><i aria-hidden="true">→</i><span className="done">committed {receipt.creditsCommitted}</span></>}
            {typeof receipt.creditsReleased === "number" && <><i aria-hidden="true">→</i><span className="released">released {receipt.creditsReleased}</span></>}
          </div>}
        </div>}

        {(receipt.originalHash || receipt.outputHash || receipt.details?.length) && <details className="receipt-advanced">
          <summary>Technical evidence <span>expand</span></summary>
          <dl className="receipt-ledger">
            {receipt.originalHash && <div><dt>Original SHA-256</dt><dd className="mono-label">{receipt.originalHash}</dd></div>}
            {receipt.outputHash && <div><dt>Output SHA-256</dt><dd className="mono-label">{receipt.outputHash}</dd></div>}
          </dl>
          {receipt.details?.length ? <div className="receipt-detail-grid">{receipt.details.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div> : null}
        </details>}

        {receipt.notes?.length ? <div className="notice-card"><strong>Review notes</strong><ul>{receipt.notes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}

        <div className="receipt-actions">
          <button type="button" className="primary" onClick={() => downloadReceipt(receipt)}>Export JSON receipt</button>
          <button type="button" className="ghost" onClick={closeDrawer}>Close</button>
        </div>

        <p className="privacy-note">This drawer keeps only the latest receipt metadata in browser memory. It does not persist raw source text, transformed prose, file bytes, or filenames.</p>
      </aside>
    </div>}
  </>;
}
