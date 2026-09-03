import Link from "next/link";
import { AccountDashboard } from "@/components/account-dashboard";

export default function AccountPage() {
  return <main className="shell"><header className="section-heading"><div><p className="eyebrow">Account</p><h1>Credits, purchases and privacy controls.</h1><p>Review the append-only credit trail and account settings without storing submitted document content in account history.</p></div><div className="actions"><Link href="/pricing">Pricing</Link><Link href="/">Workbench</Link></div></header><AccountDashboard /></main>;
}
