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
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    const upgrade = new URL(window.location.href).searchParams.get("upgrade") === "1";
    if (upgrade) {
      // The auth callback normally claims this already. Repeating the claim is intentionally
      // idempotent so an email-link variant that returns directly here cannot miss the grant.
      await fetch("/api/auth/claim-signup-promo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
    }
    setMessage(upgrade ? "Guest account upgraded. Password saved; your existing credits and history remain attached." : "Password updated. Redirecting to your account…");
    setTimeout(() => { router.push("/account"); router.refresh(); }, 700);
    setBusy(false);
  }

  return <main className="shell"><section className="panel"><p className="eyebrow">Account security</p><h1>Choose a new password</h1><form onSubmit={submit}><label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><div className="actions"><button className="primary" disabled={busy || !supabase} type="submit">{busy ? "Updating…" : "Update password"}</button><Link href="/auth">Back to sign in</Link></div></form>{message && <div className="notice-card" role="status">{message}</div>}</section></main>;
}
