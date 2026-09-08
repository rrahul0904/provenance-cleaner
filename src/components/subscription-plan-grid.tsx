"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from "@/lib/billing/subscriptions";
import { TurnstileWidget } from "@/components/turnstile-widget";

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

export function SubscriptionPlanGrid() {
  const router = useRouter();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlanId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const onToken = useCallback((token: string | null) => setChallengeToken(token), []);

  async function subscribe(planId: SubscriptionPlanId) {
    if (!challengeToken) return;
    setBusyPlan(planId);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/subscription-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, challengeToken }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        router.push("/auth");
        return;
      }
      if (!response.ok || typeof payload?.url !== "string") {
        throw new Error(messageFrom(payload, "Monthly checkout is not available."));
      }
      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Monthly checkout is not available.");
      setChallengeToken(null);
      setResetKey(value => value + 1);
      setBusyPlan(null);
    }
  }

  return <div>
    <div className="credit-pack-grid">
      {Object.values(SUBSCRIPTION_PLANS).map(plan => <article className="credit-pack-card" key={plan.id}>
        <span className="mono-label">MONTHLY PLAN</span>
        <strong>{plan.credits}<small> units / mo</small></strong>
        <h2>{plan.label}</h2>
        <p>{`$${(plan.monthlyCents / 100).toFixed(2)} / month · ${plan.credits} credits each paid period · TEST mode`}</p>
        <div className="pack-unit">One-time processing packs remain available.</div>
        <button className="primary" type="button" disabled={!challengeToken || busyPlan !== null} onClick={() => void subscribe(plan.id)}>
          {busyPlan === plan.id ? "Opening Stripe…" : `Subscribe to ${plan.label}`}
        </button>
      </article>)}
    </div>
    <TurnstileWidget action="account" onToken={onToken} resetKey={resetKey} />
    {message && <p className="notice-card" role="status">{message}</p>}
  </div>;
}
