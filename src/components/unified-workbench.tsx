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
  const [mounted, setMounted] = useState<Set<Mode>>(() => new Set<Mode>(["text"]));

  function selectMode(next: typeof MODES[number]) {
    setMounted(current => {
      if (current.has(next.id)) return current;
      const copy = new Set(current);
      copy.add(next.id);
      return copy;
    });
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
          aria-controls={`workspace-pane-${item.id}`}
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
    <div className="workspace-stage">
      <div id="workspace-pane-text" role="tabpanel" aria-labelledby="scanner" hidden={mode !== "text"}>
        <ScannerWorkbench />
      </div>
      {mounted.has("file") && <div id="workspace-pane-file" role="tabpanel" aria-labelledby="files" hidden={mode !== "file"}>
        <FileWorkbench />
      </div>}
      {mounted.has("rewrite") && <div id="workspace-pane-rewrite" role="tabpanel" aria-labelledby="editor" hidden={mode !== "rewrite"}>
        <TransformWorkbench />
      </div>}
    </div>
  </section>;
}
