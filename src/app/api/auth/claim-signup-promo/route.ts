import { emailFingerprint } from "@/lib/auth/email-fingerprint";
import { claimSignupPromoCredits } from "@/lib/billing/server";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext } from "@/lib/server/api";
import { hashIdentifier, logEvent } from "@/lib/server/observability";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({}).strict();

export async function POST(request: Request) {
  const context = requestContext(request, "/api/auth/claim-signup-promo");
  try {
    await parseJson(request, schema, 1_024);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous || !data.user.email) return apiError(context, "account_required", "A verified account email is required.", 401);
    const result = await claimSignupPromoCredits(data.user.id, emailFingerprint(data.user.email));
    logEvent("signup_promo_claim", { requestId: context.requestId, userIdHash: hashIdentifier(data.user.id), granted: result.granted });
    return apiOk(context, { granted: result.granted, balance: result.balance });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    logEvent("signup_promo_unavailable", { requestId: context.requestId });
    return apiError(context, "promo_unavailable", "Signup promotional credits are temporarily unavailable.", 503);
  }
}
