"use client";

import { useState } from "react";
import { ScannerWorkbench } from "@/components/scanner-workbench";
import { FileWorkbench } from "@/components/file-workbench";
import { TransformWorkbench } from "@/components/transform-workbench";

type Mode = "text" | "file" | "rewrite";
const MODES: { id: Mode; label: string; description: string; anchor: string }[] = [
  { id: "text", label: "Text", description: "Unicode + hidden signal inspection", anchor: "scanner" },
  { id: "file", label: "Files", description: "Metadata + provenance inspection", anchor: "files" },
  { id: "rewrite", label: "Rewrite", description: "Fact-preserving semantic editing", anchor: "editor" },
];

export function UnifiedWorkbench() {
  const [mode, setMode] = useState<Mode>("text");


  function selectMode(next: typeof MODES[number]) {
    setMode(next.id);
    window.history.replaceState({}, "", `#${next.anchor}`);
  }

  return <section id="workbench" className="unified-workbench" aria-label="Content integrity workbench">
    <div className="workspace-toolbar">
      <div className="workspace-tabs" role="tablist" aria-label="Workbench mode">
        {MODES.map(item => <button
          key={item.id}
          id={item.anchor}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          className={mode === item.id ? "active" : ""}
          onClick={() => selectMode(item)}
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </button>)}
      </div>
      <div className="workspace-assurance">
        <span className="status-dot"/>
        <div><strong>Inspection is free</strong><small>Credits commit only after verified actions</small></div>
      </div>
    </div>
    <div className="workspace-stage" role="tabpanel">
      {mode === "text" && <ScannerWorkbench />}
      {mode === "file" && <FileWorkbench />}
      {mode === "rewrite" && <TransformWorkbench />}
    </div>
  </section>;
}
