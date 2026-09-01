import { ContactMailto } from "@/components/contact-mailto";

export default function ContactPage() {
  return <main className="shell"><header className="section-heading"><div><p className="eyebrow">Contact</p><h1>Questions about privacy, billing or account data?</h1><p>Use the form to create a draft in your own email application. Provenance Cleaner does not receive the typed message unless you choose to send that email.</p></div><a href="/">Back to workbench</a></header><ContactMailto supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null} /></main>;
}
