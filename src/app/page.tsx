import Link from "next/link";
import { AccountBar } from "@/components/account-bar";
import { FileWorkbench } from "@/components/file-workbench";
import { HeroInspectionVisual, HeroWorkflowStrip, TerminalStatusCard, TrustBand, WorkflowStepper } from "@/components/quiet-forensics";
import { ScannerWorkbench } from "@/components/scanner-workbench";
import { TransformWorkbench } from "@/components/transform-workbench";

export default function Home() {
  return <main id="main-content">
    <section className="hero shell">
      <div className="hero-copy">
        <p className="eyebrow">Privacy-first content integrity</p>
        <h1>See what your content is carrying.</h1>
        <p className="lede">Inspect hidden Unicode, file metadata, provenance signals, and AI-edited prose — then clean only what is safe and keep a receipt of what changed.</p>
        <div className="hero-actions">
          <Link className="primary-link" href="#scanner">Start free inspection</Link>
          <Link className="secondary-link" href="#receipt-preview">See a verification receipt</Link>
        </div>
        <div className="hero-trust-cue"><span className="status-dot" /><strong>Local-first inspection.</strong><span>Billable actions commit credits only after verified successful work.</span></div>
        <HeroWorkflowStrip />
        <div className="hero-badges"><span>Local-first inspection</span><span>Conservative actions</span><span>Auditable credits</span><span>Exportable evidence</span></div>
        <TerminalStatusCard />
      </div>
      <HeroInspectionVisual />
    </section>

    <WorkflowStepper />
    <AccountBar />

    <section id="workbench" className="workbench-intro shell">
      <div><p className="eyebrow">Content integrity workbench</p><h2>Three tools. One evidence model.</h2></div>
      <p>Use the input that matches your content. Each workbench separates the outcome from the technical evidence so you can understand the result first, then inspect exactly what happened.</p>
    </section>

    <div id="scanner" className="shell module-anchor"><span className="module-index">A · TEXT SCANNER</span><ScannerWorkbench /></div>
    <div id="files" className="shell module-anchor"><span className="module-index">B · FILE PROVENANCE</span><FileWorkbench /></div>
    <div id="editor" className="shell module-anchor"><span className="module-index">C · PROTECTED EDITOR</span><TransformWorkbench /></div>

    <TrustBand />
    <section id="principles" className="principles shell">
      <div><span>01</span><h3>Inspect first</h3><p>Findings stay concrete: exact code points, metadata categories, hashes, and provenance validation states.</p></div>
      <div><span>02</span><h3>Preserve meaning</h3><p>Language-sensitive controls, factual spans, and signed provenance are not silently destroyed for a prettier output.</p></div>
      <div><span>03</span><h3>Fail safely</h3><p>Billable actions reserve credits, validate outcomes, and commit only after verified successful work.</p></div>
    </section>
  </main>;
}
