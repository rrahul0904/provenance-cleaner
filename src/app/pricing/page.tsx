import { MAX_FILE_BYTES, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import { PageHero } from "@/components/quiet-forensics";
import { PricingCalculator } from "@/components/pricing-calculator";
import { SubscriptionPlanGrid } from "@/components/subscription-plan-grid";
import { CreditPackGrid } from "@/components/credit-pack-grid";

export default function PricingPage() {
  return <main id="main-content">
    <PageHero
      eyebrow="Usage & pricing"
      title="Inspection is free. Pay only when you change something."
      copy="Scan text, inspect metadata, and verify provenance without consuming usage. Cleaning and protected rewriting use a simple processing allowance."
      aside="One usage unit currently covers up to 1,000 source words or one supported DOCX, PNG, or JPEG sanitation job. Failed verified actions release their hold."
    />
    <section className="shell pricing-model">
      <div className="pricing-free">
        <p className="eyebrow">Always free</p>
        <h2>Understand the content first.</h2>
        <div className="pricing-list">
          <span>Unicode / text scan</span><strong>Free</strong>
          <span>File metadata inspection</span><strong>Free</strong>
          <span>C2PA verification</span><strong>Free</strong>
        </div>
      </div>
      <div className="pricing-credit">
        <p className="eyebrow">Processing usage</p>
        <h2>Pay only for successful actions.</h2>
        <div className="pricing-list">
          <span>Text / TXT cleaning</span><strong>1 unit / 1K words</strong>
          <span>DOCX / PNG / JPEG sanitation</span><strong>1 unit</strong>
          <span>Protected semantic rewrite</span><strong>1 unit / 1K words</strong>
        </div>
      </div>
    </section>
    <section className="shell pricing-section"><div className="pricing-section-head"><div><p className="eyebrow">Monthly</p><h2>Predictable processing allowance.</h2></div><p>Unused one-time packs remain available alongside a subscription.</p></div><SubscriptionPlanGrid/></section>
    <section className="shell pricing-section"><div className="pricing-section-head"><div><p className="eyebrow">Pay as you go</p><h2>Add usage only when you need it.</h2></div><p>No subscription required. Checkout is currently running in Stripe TEST mode.</p></div><CreditPackGrid/></section>
    <div className="shell"><PricingCalculator /><section className="panel pricing-rules"><p className="eyebrow">Usage rules</p><h2>How processing is metered.</h2><div className="rule-grid"><div><strong>Text & TXT</strong><p>1 unit per 1,000 source words, rounded up.</p></div><div><strong>Protected rewrite</strong><p>Up to {MAX_REWRITE_WORDS.toLocaleString()} source words per operation.</p></div><div><strong>Files</strong><p>DOCX, PNG and JPEG sanitation is 1 unit, up to {(MAX_FILE_BYTES/(1024*1024)).toFixed(1)} MB.</p></div><div><strong>Failure</strong><p>Reserved usage is released instead of becoming a successful debit.</p></div></div></section></div>
  </main>;
}
