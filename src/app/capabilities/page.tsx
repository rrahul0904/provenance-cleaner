import Link from "next/link";
import { MAX_FILE_BYTES, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import { PageHero } from "@/components/quiet-forensics";
const GROUPS=[
["Hidden text inspection","scanner","Paste or .txt","Free local Unicode scanning, exact code points and conservative sanitation. Billable cleaning is word-metered."],
["Metadata sanitation","metadata","DOCX · PNG · JPEG",`Privacy metadata inspection and 1-credit sanitation jobs up to ${(MAX_FILE_BYTES/(1024*1024)).toFixed(1)} MB.`],
["Content Credentials","metadata","C2PA","Dedicated verification states for manifests and validation outcomes. Signed provenance is never silently stripped."],
["Semantic editing","ai","Protected editor",`Parity, Natural, Clarity, Concise and Formal modes with deterministic factual-preservation checks. Maximum ${MAX_REWRITE_WORDS.toLocaleString()} words.`],
["Credit-safe billing","billing","Reserve → verify → commit","Credits remain server-authoritative. Failed operations release holds instead of pretending work succeeded."],
["Privacy-safe history","privacy","Receipts & account","Operational job metadata, hashes where appropriate, credit state and purchase reconciliation without intentionally retaining submitted content or filenames."],
] as const;
export default function CapabilitiesPage(){return <main id="main-content"><PageHero eyebrow="Capabilities" title="Use the right tool for each integrity layer." copy="Input routing stays explicit: a file-metadata job is not silently sent through a language model, and a provenance signal is not treated like ordinary removable metadata." aside="PDF and WebP remain inspection-only advanced paths. The product labels that limitation instead of quietly rewriting unsupported structures."/><section className="shell capability-grid">{GROUPS.map(([title,tone,kicker,copy])=><article className={`capability-card ${tone}`} key={title}><span className="mono-label">{kicker}</span><h2>{title}</h2><p>{copy}</p></article>)}</section><div className="shell page-cta"><Link className="primary-link" href="/#workbench">Open the workbench</Link><Link className="secondary-link" href="/pricing">See credit rules</Link></div></main>}
