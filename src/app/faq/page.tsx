import Link from "next/link";

const FAQ = [
  ["What can Provenance Cleaner verify?", "It can deterministically rescan tracked Unicode characters, verify supported metadata removal, calculate hashes, and validate protected factual spans around semantic edits. Those checks do not prove human authorship."],
  ["Why not use a generic rewrite prompt?", "The semantic editor protects URLs, emails, quotations, dates, numbers and other factual spans, then validates the returned draft before committing a credit debit."],
  ["What if a scan finds nothing?", "Nothing is charged. Scanning is free and can be repeated without creating an account."],
  ["Which inputs are supported?", "Paste and .txt use the text route. DOCX supports Unicode/metadata hygiene. PNG and JPEG use metadata hygiene. Existing PDF/WebP inspection remains available as an additional Provenance Cleaner capability."],
  ["Do credits expire?", "No automatic expiration is applied under the current product contract."],
  ["What happens if an edit fails?", "A reserved credit hold is released rather than committed. The append-only ledger records successful debits only after validation."],
  ["Can purchased credits be refunded?", "The parity work includes a support/accounting model for unused purchased credits within the configured refund window. Real refunds remain a verified Stripe operation, not a client-side balance edit."],
  ["Does metadata cleaning preserve signed provenance?", "Signed provenance is handled more conservatively than ordinary privacy metadata. If a byte change could invalidate a hard binding, the app blocks silent sanitation and explains the consequence."],
];

export default function FaqPage() {
  return <main className="shell"><header className="section-heading"><div><p className="eyebrow">FAQ</p><h1>What the product does—and what it does not claim.</h1></div><Link href="/">Back to workbench</Link></header><div className="stack">{FAQ.map(([question, answer]) => <section className="panel" key={question}><h2>{question}</h2><p>{answer}</p></section>)}</div></main>;
}
