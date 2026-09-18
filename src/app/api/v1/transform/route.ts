import { generateText } from "ai";
import { z } from "zod";
import { transformOperationKey } from "@/lib/billing/operation-key";
import { commitReservation, releaseReservation, reserveCredits } from "@/lib/billing/server";
import { BillingDomainError } from "@/lib/billing/types";
import { authenticateDeveloperRequest } from "@/lib/developer-api";
import { countWords, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import { planSanitizationJob, SanitizationContractError } from "@/lib/sanitization";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext, retryAfter } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";
import {
  chunkProtectedText,
  prepareProtectedText,
  TRANSFORM_INTENSITIES,
  TRANSFORM_MODES,
  TRANSFORM_PURPOSES,
  TRANSFORM_SYSTEM,
  transformPrompt,
  unavailableTextWatermarkVerifier,
  validateTransformedDraft,
} from "@/lib/transform";
import type { TransformIntensity, TransformMode, TransformPurpose, TransformResult } from "@/lib/transform";

export const runtime = "nodejs";
const DEFAULT_MODEL = "mistral/mistral-medium-3.5";
const MAX_ATTEMPTS = 2;
const bodySchema = z.object({
  operationId: z.string().uuid(),
  text: z.string().trim().min(20).max(250_000),
  mode: z.enum(TRANSFORM_MODES),
  intensity: z.enum(TRANSFORM_INTENSITIES).default("balanced"),
  purpose: z.enum(TRANSFORM_PURPOSES).default("general"),
});

function wordBucket(words: number) {
  if (words <= 250) return "<=250";
  if (words <= 1_000) return "251-1000";
  if (words <= 4_000) return "1001-4000";
  return "4001-8000";
}

async function generateAttempt(
  protectedText: string,
  mode: TransformMode,
  intensity: TransformIntensity,
  purpose: TransformPurpose,
  model: string,
  retryFeedback?: string,
) {
  const outputs: string[] = [];
  for (const chunk of chunkProtectedText(protectedText)) {
    const { text } = await generateText({
      model,
      system: TRANSFORM_SYSTEM,
      prompt: transformPrompt(chunk, mode, intensity, purpose, retryFeedback),
      temperature: intensity === "light" ? 0.2 : intensity === "strong" ? 0.4 : 0.3,
    });
    outputs.push(text.trim());
  }
  return outputs.join("\n\n");
}

function billingError(context: ReturnType<typeof requestContext>, error: BillingDomainError) {
  if (error.code === "insufficient_credits") return apiError(context, error.code, "Not enough credits are available for this edit.", 402);
  if (error.code === "rate_limited" || error.code === "daily_credit_limit") {
    return apiError(context, error.code, error.code === "rate_limited" ? "Too many editing requests were started recently." : "The daily editing-credit safety limit has been reached.", 429, retryAfter(60));
  }
  if (error.code === "operation_conflict") return apiError(context, error.code, "This edit operation has already been used.", 409);
  return apiError(context, "billing_unavailable", "Billing is not available.", 503);
}

export async function POST(request: Request) {
  const context = requestContext(request, "/api/v1/transform");
  let identity;
  try { identity = await authenticateDeveloperRequest(request); }
  catch { return apiError(context, "developer_api_unavailable", "Developer API authentication is unavailable.", 503); }
  if (!identity) return apiError(context, "invalid_api_key", "A valid Bearer API key is required.", 401, { "www-authenticate": "Bearer" });

  const subject = requestSubjectKey(request, identity.keyId);
  const burst = consumeRateLimit("developer-transform", subject, configuredLimit("RATE_LIMIT_DEVELOPER_TRANSFORM_PER_MINUTE", 12), 60_000);
  if (!burst.allowed) return apiError(context, "rate_limited", "Developer transform rate limit exceeded.", 429, retryAfter(burst.retryAfterSeconds));

  let parsed: z.infer<typeof bodySchema>;
  try { parsed = await parseJson(request, bodySchema, 300_000); }
  catch (error) {
    return error instanceof ApiRequestError ? apiError(context, error.code, error.message, error.status) : apiError(context, "invalid_request", "Request is invalid.", 400);
  }

  let job;
  try { job = planSanitizationJob({ kind: "text", intent: "rewrite", text: parsed.text }); }
  catch (error) {
    if (error instanceof SanitizationContractError && error.code === "rewrite_too_large") {
      return apiError(context, "rewrite_too_large", `Semantic editing accepts at most ${MAX_REWRITE_WORDS.toLocaleString("en-US")} words per operation. Split larger documents into parts.`, 413);
    }
    return apiError(context, "invalid_request", "The rewrite job does not satisfy the product contract.", 400);
  }

  const cost = job.credits;
  const sourceWords = countWords(parsed.text);
  logEvent("developer_transform_request", {
    requestId: context.requestId,
    developerKeyHash: subject,
    operationId: parsed.operationId,
    sourceWordBucket: wordBucket(sourceWords),
    credits: cost,
    mode: parsed.mode,
    intensity: parsed.intensity,
    purpose: parsed.purpose,
  });

  let reservationId: string;
  try {
    const reservation = await reserveCredits(identity.userId, transformOperationKey(parsed.operationId), cost);
    reservationId = reservation.reservationId;
    if (!reservation.created || reservation.status !== "reserved") return apiError(context, "operation_conflict", "This edit operation is already in progress or complete.", 409);
  } catch (error) {
    if (error instanceof BillingDomainError) return billingError(context, error);
    return apiError(context, "billing_unavailable", "Billing is not available.", 503);
  }

  const prepared = prepareProtectedText(parsed.text);
  const model = process.env.TRANSFORM_MODEL ?? DEFAULT_MODEL;
  let retryFeedback: string | undefined;
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const draft = await generateAttempt(prepared.protectedText, parsed.mode, parsed.intensity, parsed.purpose, model, retryFeedback);
      const validation = validateTransformedDraft(prepared, draft, parsed.mode);
      if (validation.ok && validation.restoredText) {
        const balance = await commitReservation(identity.userId, reservationId);
        const watermark = await unavailableTextWatermarkVerifier.verify(validation.restoredText);
        const result: TransformResult = {
          version: "semantic-transform-v2",
          text: validation.restoredText,
          mode: parsed.mode,
          intensity: parsed.intensity,
          purpose: parsed.purpose,
          model,
          attempts: attempt,
          metrics: validation.metrics,
          receipt: {
            sourceWords: validation.metrics.sourceWords,
            outputWords: validation.metrics.outputWords,
            retainedPercent: validation.metrics.retainedPercent,
            wordingReplacedPercent: validation.metrics.wordingReplacedPercent,
            longestUnprotectedSharedWordRun: validation.metrics.unprotectedLongestSharedWordRun,
            protectedSpanCount: validation.metrics.protectedTotal,
            checks: validation.checks,
            model,
            attempts: attempt,
            creditsCharged: cost,
          },
          watermark,
          warnings: validation.warnings,
          billing: { operationId: parsed.operationId, reservationId, creditsCharged: cost, balanceAfter: balance.available },
        };
        logEvent("developer_transform_success", {
          requestId: context.requestId,
          developerKeyHash: subject,
          operationId: parsed.operationId,
          model,
          attempts: attempt,
          credits: cost,
          intensity: parsed.intensity,
          purpose: parsed.purpose,
          latencyMs: Date.now() - context.startedAt,
        });
        return apiOk(context, result as unknown as Record<string, unknown>);
      }
      retryFeedback = validation.errors.map((item) => `- ${item}`).join("\n");
    }
    await releaseReservation(identity.userId, reservationId, "validation_failed");
    return apiError(context, "validation_failed", "The edit did not pass factual-preservation checks. The credit hold was released.", 422);
  } catch {
    try { await releaseReservation(identity.userId, reservationId, "generation_failed"); } catch {}
    return apiError(context, "model_unavailable", "The editing service is temporarily unavailable. The credit hold was released or will expire automatically.", 503);
  }
}
