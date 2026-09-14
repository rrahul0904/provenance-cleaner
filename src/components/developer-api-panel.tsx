"use client";

import { useEffect, useState } from "react";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type CreatedKey = ApiKey & { secret: string };

export function DeveloperApiPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("Automation key");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/account/api-keys", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) {
      setEligible(false);
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setMessage("Developer API keys are temporarily unavailable.");
      setLoading(false);
      return;
    }
    const body = await response.json();
    setKeys(Array.isArray(body.keys) ? body.keys : []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function createKey() {
    setBusy(true);
    setMessage(null);
    setCreated(null);
    try {
      const response = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "API key could not be created.");
      setCreated(body.key as CreatedKey);
      setMessage("Copy this secret now. It will not be shown again.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "API key could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/api-keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "API key could not be revoked.");
      setCreated(current => current?.id === id ? null : current);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "API key could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!created) return;
    await navigator.clipboard.writeText(created.secret);
    setMessage("API secret copied. Store it in a password manager or secret store.");
  }

  if (!eligible) return null;
  return <section className="panel account-section">
    <div className="account-section-head">
      <div><span className="mono-label">DEVELOPER API</span><h2>Automation keys</h2></div>
      <span className="pill">Phase 9</span>
    </div>
    <p>Use a server-side Bearer key for deterministic scans, credit usage checks, and billable semantic transforms. Keys are available only to verified accounts. Raw secrets are shown once and are never stored by Provenance Cleaner.</p>
    <div className="danger-action">
      <label>Key name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} autoComplete="off" /></label>
      <button className="primary-link" disabled={busy || name.trim().length === 0} onClick={() => void createKey()}>{busy ? "Working…" : "Create API key"}</button>
    </div>
    {created && <div className="notice-card account-message">
      <strong>Secret shown once</strong>
      <code style={{ display: "block", overflowWrap: "anywhere", marginTop: 8 }}>{created.secret}</code>
      <button className="ghost" onClick={() => void copySecret()}>Copy secret</button>
    </div>}
    {message && <div className="notice-card account-message">{message}</div>}
    {loading ? <div className="empty-state compact">Loading developer keys…</div> : keys.length === 0 ? <div className="empty-state compact">No developer API keys yet.</div> : <div className="audit-list">
      {keys.map(key => <article className="audit-row" key={key.id}>
        <div className="job-glyph">API</div>
        <div><strong>{key.name}</strong><p>Created {new Date(key.createdAt).toLocaleString()}{key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}` : " · never used"}</p></div>
        <code>{key.prefix}…</code>
        <div className="purchase-actions">
          <span className={key.revokedAt ? "tag-review" : "tag-safe"}>{key.revokedAt ? "revoked" : "active"}</span>
          {!key.revokedAt && <button className="ghost" disabled={busy} onClick={() => void revokeKey(key.id)}>Revoke</button>}
        </div>
      </article>)}
    </div>}
    <p className="privacy-note">Never put API keys in browser code, public repositories, client-side environment variables, or logs.</p>
  </section>;
}
