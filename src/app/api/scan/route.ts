import { z } from "zod";
import { sanitizeText, scanText } from "@/lib/provenance/unicode";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

const bodySchema = z.object({ text: z.string().max(250_000), sanitize: z.enum(["none", "conservative", "aggressive"]).default("none") });
export async function POST(request: Request) {
  const context = requestContext(request, "/api/scan");
  try {
    const parsed = await parseJson(request, bodySchema, 300_000);
    const receipt = scanText(parsed.text);
    const sanitation = parsed.sanitize === "none" ? null : sanitizeText(parsed.text, parsed.sanitize);
    logEvent("scan_request", { requestId: context.requestId, sourceChars: parsed.text.length, findings: receipt.summary.total, sanitizeMode: parsed.sanitize });
    return apiOk(context, { receipt, sanitation });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    return apiError(context, "scan_failed", "The scan could not be completed.", 500);
  }
}
