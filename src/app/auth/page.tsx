import { AuthForm } from "@/components/auth-form";

export default function AuthPage() {
  return <main className="shell">
    <header className="section-heading"><div><p className="eyebrow">Provenance Cleaner account</p><h1>Keep credits and history across devices.</h1><p>Create an account with email/password or Google. A first-time verified identity can claim three signup credits once; anonymous-session ledger data remains attached when identity linking keeps the same Supabase user.</p></div><a href="/">Back to workbench</a></header>
    <AuthForm />
  </main>;
}
