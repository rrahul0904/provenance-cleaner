"use client";

import { useState } from "react";
import { ScannerWorkbench } from "@/components/scanner-workbench";
import { FileWorkbench } from "@/components/file-workbench";
import { TransformWorkbench } from "@/components/transform-workbench";

type Mode = "text" | "file" | "rewrite";
const MODES: { id: Mode; label: string; short: string; description: string; anchor: string }[] = [
  { id: "text", label: "Text inspection", short: "Text", description: "Unicode and hidden-signal inspection", anchor: "scanner" },
  { id: "file", label: "File inspection", short: "Files", description: "Metadata and provenance inspection", anchor: "files" },
  { id: "rewrite", label: "Protected rewrite", short: "Rewrite", description: "Fact-preserving semantic editing", anchor: "editor" },
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
    <aside className="workspace-rail">
      <div className="rail-heading">
        <span className="rail-overline">TOOLS</span>
        <strong>Choose a workflow</strong>
      </div>
      <div className="workspace-tabs" role="tablist" aria-label="Workbench mode">
        {MODES.map((item, index) => <button
          key={item.id}
          id={item.anchor}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          aria-controls={`workspace-pane-${item.id}`}
          className={mode === item.id ? "active" : ""}
          onClick={() => selectMode(item)}
        >
          <span className="tab-index">0{index + 1}</span>
          <span className="tab-copy"><strong>{item.short}</strong><small>{item.description}</small></span>
        </button>)}
      </div>
      <div className="rail-status">
        <span className="status-dot"/>
        <div><strong>Inspection is free</strong><small>Usage applies only to successful actions.</small></div>
      </div>
    </aside>

    <div className="workspace-main">
      <div className="workspace-context">
        <div>
          <span className="workspace-context-label">ACTIVE TOOL</span>
          <strong>{MODES.find(item => item.id === mode)?.label}</strong>
        </div>
        <span className="workspace-context-state"><i/>Ready</span>
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
    </div>
  </section>;
}
