"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/billing/catalog";
import { createClient } from "@/lib/supabase/client";
import { TurnstileWidget } from "./turnstile-widget";
import styles from "./account-bar.module.css";

interface IdentityState { userId: string; isAnonymous: boolean; }
interface BalanceState { settled: number; held: number; available: number; }
function messageFrom(payload: unknown, fallback: string) { if (payload && typeof payload === "object") { const error = (payload as { error?: unknown }).error; if (typeof error === "string") return error; if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message; } return fallback; }

export function AccountBar() {
  const supabase = useMemo(() => { try { return createClient(); } catch { return null; } }, []);
  const [identity, setIdentity] = useState<IdentityState | null>(null); const [balance, setBalance] = useState<BalanceState | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [challengeToken, setChallengeToken] = useState<string | null>(null); const [challengeReset, setChallengeReset] = useState(0);
  const onChallenge = useCallback((token: string | null) => setChallengeToken(token), []);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getClaims().then(async ({ data }) => {
      if (cancelled) return;
      const claims = data?.claims as Record<string, unknown> | undefined;
      if (!claims || typeof claims.sub !== "string") {
        setIdentity(null);
        setBalance(null);
        return;
      }
      setIdentity({ userId: claims.sub, isAnonymous: claims.is_anonymous === true || claims.is_anonymous === "true" });
      const response = await fetch("/api/billing/balance", { cache: "no-store" });
      if (!cancelled && response.ok) {
        const payload = await response.json();
        setBalance(payload.balance);
      }
    });
    return () => { cancelled = true; };
  }, [supabase]);
  function resetChallenge() { setChallengeToken(null); setChallengeReset(value => value + 1); }
  async function startGuest() { if (!challengeToken) return; setBusy(true); setMessage(null); try { const response = await fetch("/api/auth/anonymous", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeToken }) }); const payload = await response.json(); if (!response.ok) throw new Error(messageFrom(payload, "Could not start a guest session.")); setIdentity({ userId: payload.userId, isAnonymous: payload.isAnonymous !== false }); setBalance(payload.balance); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start a guest session."); } finally { setBusy(false); resetChallenge(); } }
  async function google() { if (!supabase) return; setBusy(true); setMessage(null); const redirectTo = `${window.location.origin}/auth/callback?next=/`; const result = identity?.isAnonymous ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } }) : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } }); if (result.error) { setMessage("Google sign-in could not be started."); setBusy(false); } }
  async function signOut() { setBusy(true); await fetch("/api/auth/signout", { method: "POST" }); setIdentity(null); setBalance(null); setBusy(false); }
  async function buy(packId: CreditPackId) { if (!challengeToken) return; setBusy(true); setMessage(null); try { const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId, challengeToken }) }); const payload = await response.json(); if (!response.ok) throw new Error(messageFrom(payload, "Checkout is not available.")); window.location.assign(payload.url); } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout is not available."); setBusy(false); resetChallenge(); } }
  return <section className={styles.bar} aria-label="Account and credits"><div><p className={styles.eyebrow}>Account · Phase 5</p><strong>{identity ? (identity.isAnonymous ? "Guest session" : "Signed-in account") : "No account yet"}</strong><span className={styles.subtext}>{balance ? `${balance.available} available credit${balance.available === 1 ? "" : "s"}${balance.held ? ` · ${balance.held} held` : ""}` : "Create a guest session to use metered editing."}</span></div><div className={styles.actions}>{!identity && <button disabled={busy || !supabase || !challengeToken} onClick={startGuest}>Start guest</button>}{(!identity || identity.isAnonymous) && <button disabled={busy || !supabase} onClick={google}>{identity ? "Upgrade with Google" : "Sign in with Google"}</button>}{identity && Object.values(CREDIT_PACKS).map(pack => <button className={styles.pack} disabled={busy || !challengeToken} key={pack.id} onClick={() => buy(pack.id)}>+{pack.credits}</button>)}{identity && <button className={styles.secondary} disabled={busy} onClick={signOut}>Sign out</button>}</div><TurnstileWidget action="account" onToken={onChallenge} resetKey={challengeReset} />{message && <p className={styles.message}>{message}</p>}</section>;
}
