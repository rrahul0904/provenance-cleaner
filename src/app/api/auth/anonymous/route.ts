import { z } from "zod";
import { grantGuestPromoCredits, initializeCreditAccount } from "@/lib/billing/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/abuse/turnstile";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext, retryAfter } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const schema = z.object({ challengeToken: z.string().max(2048).optional(), forClean: z.boolean().default(false) });

export async function POST(request: Request) {
  const context = requestContext(request, "/api/auth/anonymous");
  const subject = requestSubjectKey(request);
  const limit = consumeRateLimit("guest", subject, configuredLimit("RATE_LIMIT_GUEST_PER_MINUTE", 4), 60_000);
  if (!limit.allowed) {
    logEvent("rate_limit_triggered", { requestId: context.requestId, route: context.route, subjectHash: subject });
    return apiError(context, "rate_limited", "Too many guest-session requests. Try again shortly.", 429, retryAfter(limit.retryAfterSeconds));
  }
  try {
    const parsed = await parseJson(request, schema, 4_096);
    const challenge = await verifyTurnstile(parsed.challengeToken, "account");
    if (!challenge.ok) {
      logEvent("bot_challenge_failed", { requestId: context.requestId, route: context.route, reason: challenge.reason ?? "unknown" });
      return apiError(context, challenge.reason === "not_configured" ? "bot_protection_unavailable" : "bot_challenge_failed", challenge.reason === "not_configured" ? "Bot protection is not configured." : "Bot verification is required.", challenge.reason === "not_configured" ? 503 : 403);
    }
    const supabase = await createClient();
    const claims = await supabase.auth.getClaims();
    const existing = claims.data?.claims?.sub;
    const existingAnonymous = claims.data?.claims?.is_anonymous === true;
    if (typeof existing === "string") {
      let balance = await initializeCreditAccount(existing);
      let guestPromoGranted = false;
      if (parsed.forClean && existingAnonymous) {
        const promo = await grantGuestPromoCredits(existing);
        balance = promo.balance;
        guestPromoGranted = promo.granted;
      }
      logEvent("guest_session_reused", { requestId: context.requestId, userIdHash: requestSubjectKey(request, existing), guestPromoGranted, latencyMs: Date.now() - context.startedAt });
      return apiOk(context, { userId: existing, isAnonymous: existingAnonymous, balance, guestPromoGranted });
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      logEvent("guest_session_failed", { requestId: context.requestId, status: "provider_error" });
      return apiError(context, "account_unavailable", "Could not create a guest session.", 503);
    }
    let balance = await initializeCreditAccount(data.user.id);
    let guestPromoGranted = false;
    if (parsed.forClean) {
      const promo = await grantGuestPromoCredits(data.user.id);
      balance = promo.balance;
      guestPromoGranted = promo.granted;
    }
    logEvent("guest_session_created", { requestId: context.requestId, userIdHash: requestSubjectKey(request, data.user.id), guestPromoGranted, latencyMs: Date.now() - context.startedAt });
    return apiOk(context, { userId: data.user.id, isAnonymous: true, balance, guestPromoGranted });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    logEvent("guest_session_failed", { requestId: context.requestId, status: "configuration_or_backend" });
    return apiError(context, "account_unavailable", "Account service is not available.", 503);
  }
}
