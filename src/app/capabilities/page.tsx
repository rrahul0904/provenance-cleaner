import Link from "next/link";
import { MAX_FILE_BYTES, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import { PageHero } from "@/components/quiet-forensics";

const GROUPS=[
["Hidden text inspection","scanner","Paste or .txt","Free local Unicode scanning names exact code points and positions. Conservative sanitation removes only characters classified safe by default; language-sensitive joiners, direction controls and unusual spaces remain visible for review."],
["Metadata sanitation","metadata","DOCX · PNG · JPEG",`Privacy metadata inspection and 1-credit sanitation jobs up to ${(MAX_FILE_BYTES/(1024*1024)).toFixed(1)} MB. Outputs are re-inspected before the reserved credit is committed.`],
["Content Credentials","metadata","C2PA","Dedicated verification states for signed provenance manifests and validation outcomes. Cryptographically bound provenance is never silently stripped or represented as still valid after mutation."],
["Statistical text watermark","ai","Rewrite + verify contract",`Claude-style statistical text marks are not hidden Unicode. Parity mode performs substantive semantics-preserving rewriting with protected facts and deterministic validation up to ${MAX_REWRITE_WORDS.toLocaleString()} words. Because no legitimate public detector is available to this service, the product reports watermark verification as unavailable instead of claiming guaranteed removal.`],
["Semantic editing","ai","Protected editor","Parity, Natural, Clarity, Concise and Formal modes protect URLs, email addresses, quotations, citations, dates, signed numerics, currencies, percentages and reliable named entities. Receipts expose length retention, wording replacement, shared-run and invariant checks."],
["Credit-safe billing","billing","Reserve → work → verify → commit","Credits remain server-authoritative. Failed operations release holds instead of pretending work succeeded, while free inspection remains non-billable."],
["Privacy-safe history","privacy","Receipts & account","Operational job metadata, hashes where appropriate, credit state and purchase reconciliation without intentionally retaining submitted content or filenames."],
["Automation surfaces","privacy","API · CLI · browser extension","Verified-account API keys, machine-to-machine scan/transform/usage endpoints, a zero-dependency Node CLI and an MV3 browser editor extend the same product contracts beyond the web workbench."],
] as const;

export default function CapabilitiesPage(){
  return <main id="main-content">
    <PageHero
      eyebrow="Capabilities"
      title="Use the right tool for each integrity layer."
      copy="Invisible Unicode, file provenance and statistical text watermarking are different mechanisms. Provenance Cleaner keeps their handling separate so a successful check in one layer is never presented as proof about another."
      aside="PDF and WebP remain inspection-only advanced paths in the public workbench. Signed C2PA provenance is inspection-first. Statistical watermark removal is never claimed as verified without a legitimate detector."
    />
    <section className="shell capability-grid">
      {GROUPS.map(([title,tone,kicker,copy])=><article className={`capability-card ${tone}`} key={title}><span className="mono-label">{kicker}</span><h2>{title}</h2><p>{copy}</p></article>)}
    </section>
    <div className="shell page-cta"><Link className="primary-link" href="/#workbench">Open the workbench</Link><Link className="secondary-link" href="/pricing">See credit rules</Link></div>
  </main>;
}
