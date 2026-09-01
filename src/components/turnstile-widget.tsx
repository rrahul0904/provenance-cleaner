"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTurnstileSiteKey } from "@/lib/public-config";

type TurnstileApi = {
  render: (element: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void; }) => string;
  remove: (id: string) => void;
};

function api() { return (window as unknown as { turnstile?: TurnstileApi }).turnstile; }

export function TurnstileWidget({ action, onToken, resetKey = 0 }: { action: string; onToken: (token: string | null) => void; resetKey?: number; }) {
  const sitekey = getTurnstileSiteKey();
  const testBypass = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TURNSTILE_TEST_BYPASS === "1";
  const elementRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const renderWidget = useCallback(() => {
    if (testBypass) { onToken("dev-bypass"); return; }
    if (!sitekey || !elementRef.current || !api()) return;
    if (widgetRef.current) api()?.remove(widgetRef.current);
    onToken(null);
    widgetRef.current = api()!.render(elementRef.current, {
      sitekey,
      action,
      callback: token => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
  }, [action, onToken, sitekey, testBypass]);

  useEffect(() => { if (ready || testBypass) renderWidget(); return () => { if (widgetRef.current) api()?.remove(widgetRef.current); widgetRef.current = null; }; }, [ready, resetKey, renderWidget, testBypass]);

  if (testBypass) return <span className="privacy-note" data-testid="turnstile-bypass">Challenge bypass enabled for local tests.</span>;
  if (!sitekey) return <span className="privacy-note">Bot challenge is not configured.</span>;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} /><div ref={elementRef} data-testid={`turnstile-${action}`} /></>;
}
