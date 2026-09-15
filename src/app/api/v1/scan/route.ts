import { z } from "zod";
import { authenticateDeveloperRequest } from "@/lib/developer-api";
import { sanitizeText, scanText } from "@/lib/provenance/unicode";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext, retryAfter } from "@/lib/server/api";
import { wordBucketKey } from "@/lib/server/buckets";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";
import { countWords } from "@/lib/product-contract";

const bodySchema = z.object({
  text: z.string().max(250_000),
  sanitize: z.enum(["none", "conservative", "aggressive"]).default("none"),
});

export async function POST(request: Request) {
  const context = requestContext(request, "/api/v1/scan");
  let identity;
  try { identity = await authenticateDeveloperRequest(request); }
  catch { return apiError(context, "developer_api_unavailable", "Developer API authentication is unavailable.", 503); }
  if (!identity) return apiError(context, "invalid_api_key", "A valid Bearer API key is required.", 401, { "www-authenticate": "Bearer" });

  const subject = requestSubjectKey(request, identity.keyId);
  const limit = consumeRateLimit("developer-scan", subject, configuredLimit("RATE_LIMIT_DEVELOPER_SCAN_PER_MINUTE", 60), 60_000);
  if (!limit.allowed) return apiError(context, "rate_limited", "Developer scan rate limit exceeded.", 429, retryAfter(limit.retryAfterSeconds));

  try {
    const body = await parseJson(request, bodySchema, 300_000);
    const receipt = scanText(body.text);
    const sanitation = body.sanitize === "none" ? null : sanitizeText(body.text, body.sanitize);
    logEvent("developer_scan", {
      requestId: context.requestId,
      developerKeyHash: subject,
      sourceWordBucket: wordBucketKey(countWords(body.text)),
      findings: receipt.summary.total,
      sanitizeMode: body.sanitize,
    });
    return apiOk(context, { receipt, sanitation }, 200, { "cache-control": "no-store" });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    return apiError(context, "scan_failed", "The scan could not be completed.", 500);
  }
}
