import Link from "next/link";
import { AccountDashboard } from "@/components/account-dashboard";
import { PageHero } from "@/components/quiet-forensics";
export default function AccountPage(){return <main id="main-content"><PageHero eyebrow="Account" title="Credits, purchases, and privacy controls." copy="Review authoritative balances, operational job history, Stripe purchase reconciliation, refunds, and deletion controls without turning submitted document content into account history." aside="Available, held, and settled credits are shown separately so economic state stays inspectable."/><div className="shell account-shell"><div className="page-utility-links"><Link href="/pricing">Pricing ↗</Link><Link href="/#workbench">Workbench ↗</Link></div><AccountDashboard/></div></main>}
