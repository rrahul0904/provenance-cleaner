import { NextResponse } from "next/server";
import { emailFingerprint } from "@/lib/auth/email-fingerprint";
import { claimSignupPromoCredits, initializeCreditAccount } from "@/lib/billing/server";
import { requestContext } from "@/lib/server/api";
import { hashIdentifier, logEvent } from "@/lib/server/observability";
import { createClient } from "@/lib/supabase/server";

function safeInternalPath(value: string | null) { return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/"; }
export async function GET(request: Request) {
  const context = requestContext(request, "/auth/callback");
  const url = new URL(request.url); const code = url.searchParams.get("code"); const next = safeInternalPath(url.searchParams.get("next")); const promoRequested = url.searchParams.get("promo") === "1";
  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        try { await initializeCreditAccount(data.user.id); } catch { /* auth remains valid if billing is not configured */ }
        if (promoRequested && !data.user.is_anonymous && data.user.email) {
          try {
            const promo = await claimSignupPromoCredits(data.user.id, emailFingerprint(data.user.email));
            logEvent("signup_promo_claim", { requestId: context.requestId, userIdHash: hashIdentifier(data.user.id), granted: promo.granted });
          } catch {
            logEvent("signup_promo_unavailable", { requestId: context.requestId, userIdHash: hashIdentifier(data.user.id) });
          }
        }
        logEvent("oauth_callback_success", { requestId: context.requestId, userIdHash: hashIdentifier(data.user.id) });
      }
    } catch { logEvent("oauth_callback_failed", { requestId: context.requestId, status: "configuration_or_provider" }); }
  }
  const response = NextResponse.redirect(new URL(next, url.origin)); response.headers.set("x-request-id", context.requestId); return response;
}
