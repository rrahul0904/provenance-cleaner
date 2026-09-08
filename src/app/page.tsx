import Link from "next/link";
import { AccountBar } from "@/components/account-bar";
import { UnifiedWorkbench } from "@/components/unified-workbench";

export default function Home() {
  return <main id="main-content" className="product-home">
    <section className="shell product-intro">
      <div className="product-intro-copy">
        <div className="product-kicker"><span className="status-dot"/>Content integrity workbench</div>
        <h1>Inspect content.<br/>Change only what you can verify.</h1>
        <p>Find hidden Unicode, metadata, provenance, and semantic-edit risks. Clean narrowly, preserve signed evidence, and keep a receipt of every successful action.</p>
        <div className="product-intro-actions">
          <Link className="primary-link" href="#workbench">Open workbench</Link>
          <Link className="secondary-link" href="/how-it-works">How verification works</Link>
        </div>
      </div>
      <div className="product-status-grid" aria-label="Product guarantees">
        <div><span>01</span><strong>Local inspection</strong><p>Text and supported metadata inspection starts in your browser.</p></div>
        <div><span>02</span><strong>Conservative actions</strong><p>Signed provenance and review-only findings are never silently removed.</p></div>
        <div><span>03</span><strong>Verified billing</strong><p>Credits are committed only after a successful validated operation.</p></div>
        <div><span>04</span><strong>Exportable evidence</strong><p>Receipts capture outcomes, hashes, checks, and authoritative credit state.</p></div>
      </div>
    </section>

    <AccountBar />

    <section className="shell workspace-heading">
      <div>
        <p className="eyebrow">Workbench</p>
        <h2>One surface for inspection, sanitation, and protected editing.</h2>
      </div>
      <p>Switch modes without leaving the page. Results stay evidence-first: outcome up front, technical detail when you need it.</p>
    </section>

    <div className="shell"><UnifiedWorkbench /></div>

    <section className="shell product-proof-strip" aria-label="Trust model">
      <div><span>LOCAL</span><strong>Inspect before sending</strong></div>
      <div><span>NARROW</span><strong>Remove only justified signals</strong></div>
      <div><span>VERIFY</span><strong>Re-check returned output</strong></div>
      <div><span>RECEIPT</span><strong>Keep an auditable record</strong></div>
    </section>
  </main>;
}
