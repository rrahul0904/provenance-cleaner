import { getCreditBalance } from "@/lib/billing/server";
import { authenticateDeveloperRequest } from "@/lib/developer-api";
import { apiError, apiOk, requestContext, retryAfter } from "@/lib/server/api";
import { requestSubjectKey } from "@/lib/server/observability";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const context = requestContext(request, "/api/v1/usage");
  let identity;
  try { identity = await authenticateDeveloperRequest(request); }
  catch { return apiError(context, "developer_api_unavailable", "Developer API authentication is unavailable.", 503); }
  if (!identity) return apiError(context, "invalid_api_key", "A valid Bearer API key is required.", 401, { "www-authenticate": "Bearer" });

  const subject = requestSubjectKey(request, identity.keyId);
  const limit = consumeRateLimit("developer-usage", subject, configuredLimit("RATE_LIMIT_DEVELOPER_USAGE_PER_MINUTE", 30), 60_000);
  if (!limit.allowed) return apiError(context, "rate_limited", "Developer usage rate limit exceeded.", 429, retryAfter(limit.retryAfterSeconds));

  try {
    const balance = await getCreditBalance(identity.userId);
    return apiOk(context, { balance, key: { prefix: identity.prefix } }, 200, { "cache-control": "no-store" });
  } catch {
    return apiError(context, "billing_unavailable", "Usage balance is temporarily unavailable.", 503);
  }
}
