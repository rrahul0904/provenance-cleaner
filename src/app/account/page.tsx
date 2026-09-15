import Link from "next/link";
import { AccountDashboard } from "@/components/account-dashboard";
import { DeveloperApiPanel } from "@/components/developer-api-panel";
import { PageHero } from "@/components/quiet-forensics";
import { CreditPackGrid } from "@/components/credit-pack-grid";

export default function AccountPage(){return <main id="main-content"><PageHero eyebrow="Account" title="Credits, purchases, privacy, and developer access." copy="Review authoritative balances, operational job history, Stripe purchase reconciliation, refunds, deletion controls, and server-side automation keys without turning submitted document content into account history." aside="Available, held, and settled credits are shown separately so economic state stays inspectable."/><div className="shell account-shell"><div className="page-utility-links"><Link href="/pricing">Pricing ↗</Link><Link href="/#workbench">Workbench ↗</Link></div><CreditPackGrid compact/><AccountDashboard/><DeveloperApiPanel/></div></main>}
