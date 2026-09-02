import Link from "next/link";

export function HeroInspectionVisual() {
  return <div className="inspection-visual" aria-label="Illustration of document inspection and verification">
    <div className="visual-grid" aria-hidden="true" />
    <div className="document-sheet">
      <div className="document-kicker">DOCUMENT / 01</div>
      <div className="document-line wide"/><div className="document-line"/><div className="document-line medium"/>
      <div className="signal-line"><span className="document-line short"/><span className="unicode-marker">U+200B</span><span className="document-line medium"/></div>
      <div className="document-line wide"/><div className="document-line medium"/>
      <div className="metadata-chips"><span>EXIF · 4</span><span>AUTHOR · 1</span><span className="amber">C2PA · REVIEW</span></div>
    </div>
    <div className="inspection-lens"><span>INSPECT</span><i/></div>
    <div className="receipt-card">
      <div className="receipt-top"><span className="mono-label">VERIFICATION RECEIPT</span><span className="validated-stamp">VALIDATED</span></div>
      <dl><div><dt>safe removals</dt><dd>03</dd></div><div><dt>preserved</dt><dd>01</dd></div><div><dt>receipt</dt><dd className="mono-label">9F2A…71C8</dd></div></dl>
    </div>
  </div>;
}

export function TerminalStatusCard() {
  const rows = [["SCAN","local-first"],["BOT SHIELD","server verified"],["CREDIT HOLD","atomic"],["REQUEST ID","traceable"],["RECEIPT","exportable"]];
  return <div className="terminal-card" aria-label="System trust characteristics">{rows.map(([label,value]) => <div className="terminal-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function WorkflowStepper() {
  const steps = [
    ["01","Inspect","Find hidden Unicode, metadata, provenance, and risky signals.","Evidence: findings"],
    ["02","Clean / Edit","Remove only safe findings or rewrite prose under preservation checks.","Evidence: action plan"],
    ["03","Verify","Re-scan outputs and validate what changed and what stayed intact.","Evidence: checks"],
    ["04","Receipt","Keep an exportable record of hashes, outcomes, and credit state.","Evidence: receipt"],
  ];
  return <section className="workflow-strip shell" aria-labelledby="workflow-title"><div className="workflow-intro"><p className="eyebrow">The operating model</p><h2 id="workflow-title">Inspect first. Act narrowly. Verify everything.</h2></div><ol>{steps.map(([n,title,copy,evidence]) => <li key={n}><span className="step-number">{n}</span><div><h3>{title}</h3><p>{copy}</p><small>{evidence}</small></div></li>)}</ol></section>;
}

export function TrustBand() {
  return <section className="trust-band"><div className="shell"><div><p className="eyebrow">Why the receipt matters</p><h2>Trust should survive the action.</h2></div><p>Every successful operation should leave behind evidence: what was found, what was removed or preserved, what validation passed, and what economic state was committed. The product never treats a green badge as proof by itself.</p><Link href="/how-it-works">See how verification works <span aria-hidden="true">↗</span></Link></div></section>;
}

export function PageHero({ eyebrow, title, copy, aside }: { eyebrow: string; title: string; copy: string; aside?: string }) {
  return <header className="page-hero shell"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{copy}</p></div>{aside && <div className="page-hero-aside"><span className="mono-label">TRUST NOTE</span><p>{aside}</p></div>}</header>;
}
