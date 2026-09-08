import Link from "next/link";
import { AccountBar } from "@/components/account-bar";
import { UnifiedWorkbench } from "@/components/unified-workbench";

export default function Home() {
  return <main id="main-content" className="product-home">
    <section className="shell app-intro">
      <div className="app-intro-copy">
        <div className="product-kicker"><span className="status-dot"/>Content integrity workspace</div>
        <h1>Know what your content is carrying.</h1>
        <p>Inspect hidden Unicode, metadata and provenance locally. Clean only what is justified. Rewrite under factual-preservation checks. Keep a receipt when an action succeeds.</p>
      </div>
      <div className="app-intro-meta" aria-label="Product operating model">
        <div><span>INSPECT</span><strong>Free & local-first</strong></div>
        <div><span>ACT</span><strong>Explicit & narrow</strong></div>
        <div><span>VERIFY</span><strong>Before usage commits</strong></div>
      </div>
    </section>

    <div className="shell app-account-layer"><AccountBar /></div>

    <section className="shell primary-workspace">
      <div className="workspace-titlebar">
        <div>
          <span className="workspace-path">Workspace / Content integrity</span>
          <h2>Inspect, clean, and verify in one place.</h2>
        </div>
        <div className="workspace-title-actions">
          <Link href="/how-it-works">Verification model</Link>
          <Link href="/pricing">Usage & pricing</Link>
        </div>
      </div>
      <UnifiedWorkbench />
    </section>

    <section className="shell product-proof-strip" aria-label="Trust model">
      <div><span>01</span><strong>Raw inspection stays local where supported.</strong></div>
      <div><span>02</span><strong>Signed provenance is preserved, not silently stripped.</strong></div>
      <div><span>03</span><strong>Paid actions commit only after successful verification.</strong></div>
      <div><span>04</span><strong>Receipts make the result auditable.</strong></div>
    </section>
  </main>;
}
