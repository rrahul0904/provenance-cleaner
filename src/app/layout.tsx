import type { Metadata } from "next";
import { OfflineRuntime } from "@/components/offline-runtime";
import { ReceiptDrawer } from "@/components/receipt-drawer";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";
import "./quiet-forensics.css";
import "./quiet-forensics-refinement.css";
import "./account-forensics.css";
import "./admin-forensics.css";
import "./artifact-provenance.css";
import "./product-shell.css";

export const metadata: Metadata = {
  title: "Provenance Cleaner — Content integrity workbench",
  description: "Inspect hidden Unicode, metadata and provenance, clean only what is safe, protect facts during AI edits, and export verification receipts.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader />{children}<SiteFooter /><ReceiptDrawer /><OfflineRuntime /></body></html>;
}
