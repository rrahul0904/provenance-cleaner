"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Balance = { settled: number; held: number; available: number };
type LedgerEntry = { id: string; delta: number; kind: string; sourceKey: string; createdAt: string; metadata?: Record<string, unknown> };
type Purchase = { id: string; packId: string; credits: number; status: string; createdAt: string; completedAt?: string | null };
type History = { balance: Balance; ledger: LedgerEntry[]; purchases: Purchase[] };

export function AccountDashboard() {
  const supabase = useMemo(() => { try { return createClient(); } catch { return null; } }, []);
  const [email, setEmail] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) { window.location.replace("/auth"); return; }
      setEmail(data.user.email ?? null);
      setAnonymous(Boolean(data.user.is_anonymous));
      const response = await fetch("/api/account/history", { cache: "no-store" });
      if (!cancelled && response.ok) {
        const payload = await response.json();
        setHistory(payload.history as History);
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setMessage(null);
    const response = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload?.error?.message ?? "Account deletion failed."); return; }
    if (supabase) await supabase.auth.signOut();
    window.location.replace("/?account=deleted");
  }

  if (loading) return <div className="panel"><p>Loading account…</p></div>;
  if (!history) return <div className="panel"><p>Account history is unavailable or you are signed out.</p><a href="/auth">Sign in</a></div>;

  return <div className="stack">
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Account</p><h2>{anonymous ? "Guest account" : email ?? "Account"}</h2></div><span className="pill">{history.balance.available} credits</span></div><div className="metrics"><Metric label="Settled" value={history.balance.settled} /><Metric label="Held" value={history.balance.held} /><Metric label="Available" value={history.balance.available} /></div><p className="privacy-note">History contains operational credit metadata only. Submitted text, transformed prose, file contents and filenames are intentionally excluded.</p>{anonymous && <a href="/auth">Upgrade this guest account</a>}</section>

    <section className="panel"><p className="eyebrow">Credit history</p><h2>Ledger</h2>{history.ledger.length === 0 ? <div className="empty-state compact">No credit activity yet.</div> : <div className="findings">{history.ledger.map(entry => <article className="finding" key={entry.id}><div><strong>{entry.delta > 0 ? `+${entry.delta}` : entry.delta} · {entry.kind.replaceAll("_", " ")}</strong><p>{new Date(entry.createdAt).toLocaleString()}</p></div><span className={entry.delta > 0 ? "tag-safe" : "tag-review"}>{entry.sourceKey.startsWith("reservation:") ? "usage" : entry.kind}</span></article>)}</div>}</section>

    <section className="panel"><p className="eyebrow">Purchases</p><h2>Checkout history</h2>{history.purchases.length === 0 ? <div className="empty-state compact">No credit-pack purchases yet.</div> : <div className="findings">{history.purchases.map(purchase => <article className="finding" key={purchase.id}><div><strong>{purchase.packId} · {purchase.credits} credits</strong><p>{new Date(purchase.createdAt).toLocaleString()}</p></div><span className={purchase.status === "completed" ? "tag-safe" : "tag-review"}>{purchase.status}</span></article>)}</div>}</section>

    <section className="panel"><p className="eyebrow">Danger zone</p><h2>Delete account</h2><p>Deleting the account removes the Supabase identity and cascades its app credit/history rows. Unused credits are lost. A non-reversible keyed email fingerprint may remain solely to prevent repeated signup-credit abuse; payment processors may separately retain legally required transaction records.</p><label>Type DELETE to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><div className="actions"><button className="secondary" disabled={confirmation !== "DELETE"} onClick={() => void deleteAccount()}>Delete my account</button></div>{message && <div className="error-card">{message}</div>}</section>
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
