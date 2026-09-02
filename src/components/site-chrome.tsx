"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  ["How it works", "/how-it-works"],
  ["Workbench", "/#workbench"],
  ["Capabilities", "/capabilities"],
  ["Pricing", "/pricing"],
  ["FAQ", "/faq"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    document.body.dataset.menuOpen = "true";
    return () => { document.removeEventListener("keydown", close); delete document.body.dataset.menuOpen; };
  }, [open]);

  return <header className="site-header">
    <div className="nav shell">
      <Link className="brand" href="/" aria-label="Provenance Cleaner home">provenance<span>/clean</span></Link>
      <nav className="desktop-nav" aria-label="Primary">
        {NAV_ITEMS.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <div className="nav-actions">
        <Link className="nav-credit" href="/pricing">Credits</Link>
        <Link className="nav-account" href="/account">Account</Link>
        <button className="menu-trigger" type="button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(value => !value)}>
          <span/><span/><span/>
        </button>
      </div>
    </div>
    <div id="mobile-navigation" className={`mobile-menu ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="shell mobile-menu-inner">
        <p className="eyebrow">Content integrity workbench</p>
        <nav aria-label="Mobile primary">
          {NAV_ITEMS.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}<span aria-hidden="true">↗</span></Link>)}
          <Link href="/account" onClick={() => setOpen(false)}>Account <span aria-hidden="true">↗</span></Link>
          <Link href="/contact" onClick={() => setOpen(false)}>Contact <span aria-hidden="true">↗</span></Link>
        </nav>
        <div className="mobile-menu-footer">
          <div><span className="mono-label">PRIVACY MODEL</span><strong>Inspect locally. Send only when you choose an action.</strong></div>
          <Link className="primary-link" href="/#scanner" onClick={() => setOpen(false)}>Start free scan</Link>
        </div>
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="shell footer-grid">
      <div className="footer-brand"><Link className="brand" href="/">provenance<span>/clean</span></Link><p>A privacy-first content integrity workbench where actions are inspected, justified, verified, and receipted.</p></div>
      <nav aria-label="Legal"><Link href="/privacy-policy">Privacy</Link><Link href="/terms-of-service">Terms</Link><Link href="/cookie-policy">Cookies</Link><Link href="/contact">Contact</Link><Link href="/auth">Sign in</Link></nav>
      <div className="footer-trust"><span className="status-dot"/>Evidence over claims · raw content is not intentionally retained</div>
    </div>
  </footer>;
}
