"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => { try { return createClient(); } catch { return null; } }, []);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else { setMessage("Password updated. Redirecting to your account…"); setTimeout(() => { router.push("/account"); router.refresh(); }, 700); }
    setBusy(false);
  }

  return <main className="shell"><section className="panel"><p className="eyebrow">Account recovery</p><h1>Choose a new password</h1><form onSubmit={submit}><label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><div className="actions"><button className="primary" disabled={busy || !supabase} type="submit">{busy ? "Updating…" : "Update password"}</button><Link href="/auth">Back to sign in</Link></div></form>{message && <div className="notice-card">{message}</div>}</section></main>;
}
