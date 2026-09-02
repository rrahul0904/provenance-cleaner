"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function callbackUrl(origin: string, next: string, promo: boolean) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  url.searchParams.set("promo", promo ? "1" : "0");
  return url.toString();
}

export function AuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => { try { return createClient(); } catch { return null; } }, []);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function inspectIdentity() {
      if (!supabase) { if (!cancelled) setIdentityChecked(true); return; }
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setAnonymous(Boolean(data.user?.is_anonymous));
        setIdentityChecked(true);
      }
    }
    void inspectIdentity().catch(() => { if (!cancelled) setIdentityChecked(true); });
    return () => { cancelled = true; };
  }, [supabase]);

  async function claimPromo() {
    await fetch("/api/auth/claim-signup-promo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !identityChecked) return;
    setBusy(true); setMessage(null);
    try {
      if (mode === "signup" && anonymous) {
        const redirectTo = callbackUrl(window.location.origin, "/auth/update-password?upgrade=1", true);
        const { data, error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
        if (error) throw error;
        if (data.user && !data.user.is_anonymous) {
          await claimPromo();
          router.push("/auth/update-password?upgrade=1");
          router.refresh();
          return;
        }
        setMessage("Check your email to verify this address. After verification you will choose a password; this keeps the same guest user, credits, and history.");
        return;
      }

      if (mode === "signup") {
        const redirectTo = callbackUrl(window.location.origin, "/account", true);
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session) {
          await claimPromo();
          router.push("/account");
          router.refresh();
          return;
        }
        setMessage("Check your email to confirm the account. The one-time signup credit grant is claimed after confirmation.");
        return;
      }

      if (anonymous) {
        setMessage("This browser currently has a guest account with its own credit history. To avoid silently replacing that guest session, convert it with Sign up or Google instead of signing into a different existing account here.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/account");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Authentication could not be completed.");
    } finally { setBusy(false); }
  }

  async function google() {
    if (!supabase || !identityChecked) return;
    setBusy(true); setMessage(null);
    const redirectTo = callbackUrl(window.location.origin, "/account", mode === "signup" || anonymous);
    const result = anonymous
      ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
      : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (result.error) { setMessage("Google sign-in could not be started."); setBusy(false); }
  }

  async function resetPassword() {
    if (!supabase || !email) { setMessage("Enter your email first."); return; }
    if (anonymous) { setMessage("Convert or leave the current guest session before requesting a password reset for another account."); return; }
    setBusy(true); setMessage(null);
    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMessage(error ? error.message : "If the address is eligible, a password-reset email has been sent.");
    setBusy(false);
  }

  const anonymousUpgrade = anonymous && mode === "signup";
  return <div className="panel">
    <div className="panel-heading"><div><p className="eyebrow">Account</p><h2>{anonymousUpgrade ? "Keep this guest account" : mode === "signup" ? "Create an account" : "Sign in"}</h2></div><span className="pill">+3 signup credits once</span></div>
    {anonymous && <div className="notice-card">A guest session is active. Converting it preserves the same Supabase user ID so existing guest credits and ledger history stay attached.</div>}
    <div className="actions"><button type="button" className={mode === "signup" ? "primary" : "ghost"} onClick={() => { setMode("signup"); setMessage(null); }}>Sign up</button><button type="button" className={mode === "signin" ? "primary" : "ghost"} onClick={() => { setMode("signin"); setMessage(null); }}>Sign in</button></div>
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      {!anonymousUpgrade && <label>Password<input type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={event => setPassword(event.target.value)} /></label>}
      {anonymousUpgrade && <p className="privacy-note">Supabase requires the email identity to be verified before a password can be added to an anonymous user. We will send the verification first, then ask you to choose the password.</p>}
      <div className="actions"><button className="primary" disabled={busy || !supabase || !identityChecked} type="submit">{busy ? "Working…" : anonymousUpgrade ? "Verify email and keep guest history" : mode === "signup" ? "Create account" : "Sign in"}</button><button className="secondary" disabled={busy || !supabase || !identityChecked} type="button" onClick={google}>{anonymous ? "Link Google and keep guest history" : "Continue with Google"}</button>{mode === "signin" && <button className="ghost" disabled={busy} type="button" onClick={resetPassword}>Forgot password</button>}</div>
    </form>
    <p className="privacy-note">Guest upgrades use Supabase identity linking instead of creating a replacement user. Ordinary sign-in never claims the signup promotion.</p>
    {message && <div className="notice-card" role="status">{message}</div>}
  </div>;
}
