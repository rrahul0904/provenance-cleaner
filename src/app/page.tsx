import { AccountBar } from "@/components/account-bar";
import { FileWorkbench } from "@/components/file-workbench";
import { ScannerWorkbench } from "@/components/scanner-workbench";
import { TransformWorkbench } from "@/components/transform-workbench";

export default function Home() {
  return <main>
    <header className="nav shell"><a className="brand" href="#">provenance<span>/clean</span></a><nav aria-label="Primary"><a href="#scanner">Text</a><a href="#files">Files</a><a href="#editor">Editor</a><a href="#principles">Principles</a><a href="https://github.com/rrahul0904/provenance-cleaner" target="_blank" rel="noreferrer">GitHub</a></nav></header>
    <AccountBar />
    <section className="hero shell"><div className="hero-copy"><p className="eyebrow">AI provenance & content hygiene</p><h1>See what your content is carrying.</h1><p className="lede">Inspect invisible Unicode and provenance signals, remove only what is safe, edit prose with factual guardrails, and keep a receipt of every change.</p><div className="hero-badges"><span>Deterministic first</span><span>Privacy-safe operations</span><span>Auditable credits</span></div></div><div className="hero-card" aria-hidden="true"><div className="terminal-line"><span>SCAN</span><strong>local-first</strong></div><div className="terminal-line"><span>BOT SHIELD</span><strong>server verified</strong></div><div className="terminal-line"><span>CREDIT HOLD</span><strong>atomic</strong></div><div className="terminal-line"><span>REQUEST ID</span><strong>traceable</strong></div></div></section>
    <div id="scanner" className="shell"><ScannerWorkbench /></div><div id="files" className="shell"><FileWorkbench /></div><div id="editor" className="shell"><TransformWorkbench /></div>
    <section id="principles" className="principles shell"><div><span>01</span><h3>Inspect first</h3><p>Findings stay concrete: exact Unicode code points, file metadata categories, hashes, and provenance validation states.</p></div><div><span>02</span><h3>Preserve meaning</h3><p>Language-sensitive controls and signed provenance are not silently destroyed, and semantic edits protect factual spans before generation.</p></div><div><span>03</span><h3>Fail safely</h3><p>Expensive actions are bot-checked, rate-bounded, correlated by request ID, and credits commit only after validated success.</p></div></section>
    <footer className="shell footer">Phase 5 · Production hardening · Provenance + validated editing + auditable credits</footer>
  </main>;
}
