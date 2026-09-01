import Link from "next/link";

export function SiteHeader() {
  return <header className="nav shell"><Link className="brand" href="/">provenance<span>/clean</span></Link><nav aria-label="Primary"><Link href="/how-it-works">How it works</Link><Link href="/capabilities">Capabilities</Link><Link href="/mission">Mission</Link><Link href="/pricing">Pricing</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contact</Link><Link href="/account">Account</Link></nav></header>;
}

export function SiteFooter() {
  return <footer className="shell footer"><span>Provenance Cleaner</span><nav aria-label="Legal"><Link href="/privacy-policy">Privacy</Link><Link href="/terms-of-service">Terms</Link><Link href="/cookie-policy">Cookies</Link><Link href="/auth">Sign in</Link></nav></footer>;
}
