import Link from "next/link";

export function HeroWorkflowStrip() {
  const steps = [
    ["01", "Drop content", "Paste text or choose a supported file."],
    ["02", "See hidden signals", "Locate Unicode, metadata, provenance, or preservation risks."],
    ["03", "Clean safely", "Remove only what the evidence says is safe, or edit under factual checks."],
    ["04", "Get proof", "Re-inspect the output and keep a verification receipt."],
  ];

  return <div className="hero-workflow" aria-label="Provenance Cleaner workflow">
    {steps.map(([number, title, copy], index) => <div className="hero-workflow-step" key={number}>
      <span className="hero-workflow-index">{number}</span>
      <div>
        <strong>{title}</strong>
        <small>{copy}</small>
      </div>
      {index < steps.length - 1 && <span className="hero-workflow-arrow" aria-hidden="true">→</span>}
    </div>)}
  </div>;
}

export function HeroInspectionVisual() {
  return <div id="receipt-preview" className="inspection-visual" aria-label="Illustration of document inspection and verification">
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
      <div className="receipt-mini-timeline" aria-hidden="true"><span>inspect</span><i/> <span>act</span><i/> <span>verify</span><i/> <strong>receipt</strong></div>
      <dl><div><dt>safe removals</dt><dd>03</dd></div><div><dt>preserved</dt><dd>01</dd></div><div><dt>receipt</dt><dd className="mono-label">9F2A…71C8</dd></div></dl>
      <p>Verified. Safe findings were removed and the output was re-inspected.</p>
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
