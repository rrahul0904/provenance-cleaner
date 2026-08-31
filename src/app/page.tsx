import { ScannerWorkbench } from "@/components/scanner-workbench";
import { FileWorkbench } from "@/components/file-workbench";

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#">provenance<span>/clean</span></a>
        <nav aria-label="Primary">
          <a href="#scanner">Text</a>
          <a href="#files">Files</a>
          <a href="#principles">Principles</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </header>

      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">AI provenance & content hygiene</p>
          <h1>See what your document is carrying.</h1>
          <p className="lede">Inspect invisible Unicode and provenance signals, remove only what is safe, and keep a receipt of every change.</p>
          <div className="hero-badges">
            <span>Deterministic</span><span>Explainable</span><span>No detector theater</span>
          </div>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="terminal-line"><span>SCAN</span><strong>12,408 chars</strong></div>
          <div className="terminal-line"><span>ZERO WIDTH</span><strong>3</strong></div>
          <div className="terminal-line"><span>BIDI</span><strong>1 review</strong></div>
          <div className="terminal-line"><span>SAFE CLEAN</span><strong>ready</strong></div>
        </div>
      </section>

      <div id="scanner" className="shell"><ScannerWorkbench /></div>

      <div id="files" className="shell"><FileWorkbench /></div>

      <section id="principles" className="principles shell">
        <div><span>01</span><h3>Inspect first</h3><p>Every finding identifies the exact Unicode code point and its position.</p></div>
        <div><span>02</span><h3>Preserve meaning</h3><p>Language and emoji-sensitive controls are review-required, not silently deleted.</p></div>
        <div><span>03</span><h3>Prove changes</h3><p>Cleaning produces a receipt instead of an unverifiable “watermark removed” claim.</p></div>
      </section>

      <footer className="shell footer">Phase 1 · Text + file provenance scanner · Working product name</footer>
    </main>
  );
}
