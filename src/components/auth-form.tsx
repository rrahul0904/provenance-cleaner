"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const supabase = useMemo(() => { try { return createClient(); } catch { return null; } }, []);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function claimPromo() {
    await fetch("/api/auth/claim-signup-promo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/account`;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session) {
          await claimPromo();
          window.location.assign("/account");
          return;
        }
        setMessage("Check your email to confirm the account. The one-time signup credit grant is claimed after confirmation.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await claimPromo();
        window.location.assign("/account");
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Authentication could not be completed.");
    } finally { setBusy(false); }
  }

  async function google() {
    if (!supabase) return;
    setBusy(true); setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/account`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { setMessage("Google sign-in could not be started."); setBusy(false); }
  }

  async function resetPassword() {
    if (!supabase || !email) { setMessage("Enter your email first."); return; }
    setBusy(true); setMessage(null);
    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMessage(error ? error.message : "If the address is eligible, a password-reset email has been sent.");
    setBusy(false);
  }

  return <div className="panel">
    <div className="panel-heading"><div><p className="eyebrow">Account</p><h2>{mode === "signup" ? "Create an account" : "Sign in"}</h2></div><span className="pill">+3 signup credits once</span></div>
    <div className="actions"><button type="button" className={mode === "signup" ? "primary" : "ghost"} onClick={() => setMode("signup")}>Sign up</button><button type="button" className={mode === "signin" ? "primary" : "ghost"} onClick={() => setMode("signin")}>Sign in</button></div>
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <div className="actions"><button className="primary" disabled={busy || !supabase} type="submit">{busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button><button className="secondary" disabled={busy || !supabase} type="button" onClick={google}>Continue with Google</button>{mode === "signin" && <button className="ghost" disabled={busy} type="button" onClick={resetPassword}>Forgot password</button>}</div>
    </form>
    <p className="privacy-note">If you upgrade an anonymous session with Google from the workbench, Supabase links the identity to the same user so the existing credit ledger remains attached.</p>
    {message && <div className="notice-card">{message}</div>}
  </div>;
}
