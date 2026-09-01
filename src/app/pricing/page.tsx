import Link from "next/link";
import { CREDIT_PACKS } from "@/lib/billing/catalog";
import { MAX_FILE_BYTES, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import { PricingCalculator } from "@/components/pricing-calculator";

export default function PricingPage() {
  return <main className="shell">
    <header className="section-heading"><div><p className="eyebrow">Pricing</p><h1>Pay for successful cleaning work, not scanning.</h1><p>Scanning is free. New guests can receive 2 promotional credits on their first clean, and a real account can claim 3 additional signup credits once. Credits do not expire under normal use.</p></div><Link href="/">Back to workbench</Link></header>
    <section className="principles">
      {Object.values(CREDIT_PACKS).map(pack => <div key={pack.id}><span>{pack.credits} credits</span><h3>{pack.label} · ${pack.priceUsd.toFixed(2)}</h3><p>One-time TEST/hosted Checkout pack. No subscription or automatic renewal.</p></div>)}
    </section>
    <PricingCalculator />
    <section className="panel">
      <p className="eyebrow">Job rules</p>
      <h2>What costs a credit?</h2>
      <ul>
        <li>Pasted text and .txt: 1 credit per 1,000 source words, rounded up.</li>
        <li>Semantic rewrite: maximum {MAX_REWRITE_WORDS.toLocaleString()} words per operation.</li>
        <li>DOCX, PNG and JPEG cleaning jobs: flat 1 credit each, up to {(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB.</li>
        <li>Free scans never debit credits.</li>
        <li>Failed reserved operations release the hold instead of committing a debit.</li>
      </ul>
    </section>
  </main>;
}
