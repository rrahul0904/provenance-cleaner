"use client";

import { useEffect, useState } from "react";

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
  findingsRemoved?: number;
  findingsPreserved?: number;
  verification?: string;
  details?: Array<{ label: string; value: string | number }>;
  notes?: string[];
};

export function emitReceipt(detail: ReceiptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReceiptDetail>("provenance:receipt", { detail: { ...detail, timestamp: detail.timestamp ?? new Date().toISOString() } }));
}

function downloadReceipt(receipt: ReceiptDetail) {
  const blob = new Blob([JSON.stringify({ version: "ui-receipt-v1", ...receipt }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `provenance-receipt-${receipt.id.slice(0, 12)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ReceiptDrawer() {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [open, setOpen] = useState(false);
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
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  if (!receipt) return null;
  return <>
    <button type="button" className="receipt-fab" onClick={() => setOpen(true)} aria-label="View latest verification receipt"><span className="status-dot"/>View receipt</button>
    {open && <div className="receipt-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <aside className="receipt-drawer" role="dialog" aria-modal="true" aria-labelledby="receipt-drawer-title">
        <div className="receipt-drawer-head"><div><p className="eyebrow">Forensic ledger</p><h2 id="receipt-drawer-title">{receipt.title}</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close receipt">×</button></div>
        <div className="receipt-timeline"><div className="active"><span/>Inspected</div><div className="active"><span/>Actioned</div><div className="active"><span/>Verified</div><div className={receipt.status === "pending" ? "" : "active"}><span/>Receipted</div></div>
        <div className="receipt-status-row"><span className={`receipt-status ${receipt.status}`}>{receipt.status}</span><span className="mono-label">{receipt.operation}</span></div>
        <dl className="receipt-ledger">
          <div><dt>Operation ID</dt><dd className="mono-label">{receipt.id}</dd></div>
          <div><dt>Timestamp</dt><dd>{receipt.timestamp ? new Date(receipt.timestamp).toLocaleString() : "Now"}</dd></div>
          {receipt.accountState && <div><dt>Account</dt><dd>{receipt.accountState}</dd></div>}
          {receipt.inputSizeBucket && <div><dt>Input size</dt><dd>{receipt.inputSizeBucket}</dd></div>}
          {receipt.originalHash && <div><dt>Original hash</dt><dd className="mono-label">{receipt.originalHash}</dd></div>}
          {receipt.outputHash && <div><dt>Output hash</dt><dd className="mono-label">{receipt.outputHash}</dd></div>}
          {typeof receipt.findingsRemoved === "number" && <div><dt>Findings removed</dt><dd>{receipt.findingsRemoved}</dd></div>}
          {typeof receipt.findingsPreserved === "number" && <div><dt>Findings preserved</dt><dd>{receipt.findingsPreserved}</dd></div>}
          {typeof receipt.creditsReserved === "number" && <div><dt>Credits reserved</dt><dd>{receipt.creditsReserved}</dd></div>}
          {typeof receipt.creditsCommitted === "number" && <div><dt>Credits committed</dt><dd>{receipt.creditsCommitted}</dd></div>}
          {typeof receipt.creditsReleased === "number" && <div><dt>Credits released</dt><dd>{receipt.creditsReleased}</dd></div>}
        </dl>
        {receipt.details?.length ? <div className="receipt-detail-grid">{receipt.details.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div> : null}
        {receipt.verification && <div className="verification-box"><strong>Verification</strong><p>{receipt.verification}</p></div>}
        {receipt.notes?.length ? <div className="notice-card"><strong>Review notes</strong><ul>{receipt.notes.map(note => <li key={note}>{note}</li>)}</ul></div> : null}
        <div className="receipt-actions"><button type="button" className="primary" onClick={() => downloadReceipt(receipt)}>Export JSON receipt</button><button type="button" className="ghost" onClick={() => setOpen(false)}>Close</button></div>
        <p className="privacy-note">This drawer keeps only the latest receipt metadata in browser memory. It does not persist raw source text, transformed prose, file bytes, or filenames.</p>
      </aside>
    </div>}
  </>;
}
