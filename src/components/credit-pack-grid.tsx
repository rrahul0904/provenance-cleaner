"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/billing/catalog";
import { TurnstileWidget } from "@/components/turnstile-widget";

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    if (typeof error === "string") return error;
  }
  return fallback;
}

export function CreditPackGrid({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busyPack, setBusyPack] = useState<CreditPackId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const onToken = useCallback((token: string | null) => setChallengeToken(token), []);

  async function buy(packId: CreditPackId) {
    if (!challengeToken) return;
    setBusyPack(packId);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId, challengeToken }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        router.push("/auth");
        return;
      }
      if (!response.ok || typeof payload?.url !== "string") {
        throw new Error(messageFrom(payload, "Checkout is not available."));
      }
      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout is not available.");
      setChallengeToken(null);
      setResetKey(value => value + 1);
      setBusyPack(null);
    }
  }

  if (compact) {
    return <div className="account-topup">
      <div className="account-topup-head">
        <div><p className="eyebrow">One-time top up</p><h2>Add processing allowance without a subscription.</h2></div>
        <span className="pill">Stripe TEST</span>
      </div>
      <div className="account-topup-actions">
        {Object.values(CREDIT_PACKS).map(pack => <button
          key={pack.id}
          className="ghost"
          type="button"
          disabled={!challengeToken || busyPack !== null}
          onClick={() => void buy(pack.id)}
        >
          {busyPack === pack.id ? "Opening Stripe…" : `${pack.credits} units · ${pack.priceUsd.toFixed(2)}`}
        </button>)}
      </div>
      <TurnstileWidget action="account" onToken={onToken} resetKey={resetKey} />
      {message && <p className="notice-card" role="status">{message}</p>}
    </div>;
  }

  return <div>
    <div className="credit-pack-grid">
      {Object.values(CREDIT_PACKS).map((pack, index) => <article className={`credit-pack-card ${index === 1 ? "featured" : ""}`} key={pack.id}>
        <span className="mono-label">{index === 1 ? "MOST FLEXIBLE" : "ONE-TIME PACK"}</span>
        <strong>{pack.credits}<small> units</small></strong>
        <h2>{pack.label}</h2>
        <p>{`$${pack.priceUsd.toFixed(2)} · hosted Stripe TEST Checkout · no subscription`}</p>
        <div className="pack-unit">{`$${(pack.priceUsd / pack.credits).toFixed(2)} / unit`}</div>
        <button className={index === 1 ? "secondary" : "primary"} type="button" disabled={!challengeToken || busyPack !== null} onClick={() => void buy(pack.id)}>
          {busyPack === pack.id ? "Opening Stripe…" : `Buy ${pack.label}`}
        </button>
      </article>)}
    </div>
    <TurnstileWidget action="account" onToken={onToken} resetKey={resetKey} />
    {message && <p className="notice-card" role="status">{message}</p>}
  </div>;
}
