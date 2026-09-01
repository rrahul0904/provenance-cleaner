import { generateText } from "ai";
import { z } from "zod";
import { verifyTurnstile } from "@/lib/abuse/turnstile";
import { getRequestIdentity } from "@/lib/auth/identity";
import { creditCostForText } from "@/lib/billing/catalog";
import { commitReservation, releaseReservation, reserveCredits } from "@/lib/billing/server";
import { BillingDomainError } from "@/lib/billing/types";
import { countWords, MAX_REWRITE_WORDS, validateRewriteWordCount } from "@/lib/product-contract";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext, retryAfter } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";
import { chunkProtectedText, prepareProtectedText, TRANSFORM_MODES, TRANSFORM_SYSTEM, transformPrompt, validateTransformedDraft } from "@/lib/transform";
import type { TransformMode, TransformResult } from "@/lib/transform";

export const runtime = "nodejs";
const DEFAULT_MODEL = "mistral/mistral-medium-3.5";
const MAX_ATTEMPTS = 2;
const PREVIEW_RELEASE_SMOKE_MARKER = "[[PROVENANCE_PREVIEW_RELEASE_SMOKE]]";
const bodySchema = z.object({ operationId: z.string().uuid(), text: z.string().min(20).max(250_000), mode: z.enum(TRANSFORM_MODES), challengeToken: z.string().max(2048).optional() });

async function generateAttempt(protectedText: string, mode: TransformMode, model: string, retryFeedback?: string) {
  const outputs: string[] = [];
  for (const chunk of chunkProtectedText(protectedText)) {
    const { text } = await generateText({ model, system: TRANSFORM_SYSTEM, prompt: transformPrompt(chunk, mode, retryFeedback), temperature: 0.3 });
    outputs.push(text.trim());
  }
  return outputs.join("\n\n");
}

function billingError(context: ReturnType<typeof requestContext>, error: BillingDomainError) {
  if (error.code === "insufficient_credits") return apiError(context, error.code, "Not enough credits are available for this edit.", 402);
  if (error.code === "rate_limited" || error.code === "daily_credit_limit") return apiError(context, error.code, error.code === "rate_limited" ? "Too many editing requests were started recently." : "The daily editing-credit safety limit has been reached.", 429, retryAfter(60));
  if (error.code === "operation_conflict") return apiError(context, error.code, "This edit operation has already been used.", 409);
  return apiError(context, "billing_unavailable", "Billing is not available.", 503);
}

export async function POST(request: Request) {
  const context = requestContext(request, "/api/transform");
  let identity: Awaited<ReturnType<typeof getRequestIdentity>>;
  try { identity = await getRequestIdentity(); } catch { return apiError(context, "account_unavailable", "Account service is not available.", 503); }
  if (!identity) return apiError(context, "auth_required", "Start a guest session or sign in before running an edit.", 401);
  const subject = requestSubjectKey(request, identity.userId);
  const burst = consumeRateLimit("transform", subject, configuredLimit("RATE_LIMIT_TRANSFORM_PER_MINUTE", 8), 60_000);
  if (!burst.allowed) {
    logEvent("rate_limit_triggered", { requestId: context.requestId, route: context.route, userIdHash: subject });
    return apiError(context, "rate_limited", "Too many edit requests. Try again shortly.", 429, retryAfter(burst.retryAfterSeconds));
  }

  let parsed: z.infer<typeof bodySchema>;
  try { parsed = await parseJson(request, bodySchema, 300_000); }
  catch (error) { return error instanceof ApiRequestError ? apiError(context, error.code, error.message, error.status) : apiError(context, "invalid_request", "Request is invalid.", 400); }

  const rewriteLimit = validateRewriteWordCount(parsed.text);
  if (!rewriteLimit.ok) return apiError(context, "rewrite_too_large", `Semantic editing accepts at most ${MAX_REWRITE_WORDS.toLocaleString("en-US")} words per operation. Split larger documents into parts.`, 413);

  const challenge = await verifyTurnstile(parsed.challengeToken, "transform");
  if (!challenge.ok) {
    logEvent("bot_challenge_failed", { requestId: context.requestId, route: context.route, userIdHash: subject, reason: challenge.reason ?? "unknown" });
    return apiError(context, challenge.reason === "not_configured" ? "bot_protection_unavailable" : "bot_challenge_failed", challenge.reason === "not_configured" ? "Bot protection is not configured." : "Bot verification is required.", challenge.reason === "not_configured" ? 503 : 403);
  }

  const cost = creditCostForText(parsed.text);
  const sourceWords = countWords(parsed.text);
  logEvent("transform_request", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, sourceChars: parsed.text.length, sourceWords, credits: cost });
  let reservationId: string;
  try {
    const reservation = await reserveCredits(identity.userId, `transform:${parsed.operationId}`, cost);
    reservationId = reservation.reservationId;
    if (!reservation.created || reservation.status !== "reserved") return apiError(context, "operation_conflict", "This edit operation is already in progress or complete.", 409);
    logEvent("credit_reservation", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, credits: cost });
  } catch (error) {
    if (error instanceof BillingDomainError) {
      logEvent(error.code === "insufficient_credits" ? "insufficient_credits" : "billing_reservation_rejected", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, status: error.code });
      return billingError(context, error);
    }
    return apiError(context, "billing_unavailable", "Billing is not available.", 503);
  }

  const prepared = prepareProtectedText(parsed.text);
  const model = process.env.TRANSFORM_MODEL ?? DEFAULT_MODEL;
  const injectPreviewFailure = process.env.VERCEL_ENV === "preview" && parsed.text.includes(PREVIEW_RELEASE_SMOKE_MARKER);
  let retryFeedback: string | undefined;
  try {
    if (injectPreviewFailure) throw new Error("controlled_preview_release_smoke");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const draft = await generateAttempt(prepared.protectedText, parsed.mode, model, retryFeedback);
      const validation = validateTransformedDraft(prepared, draft, parsed.mode);
      if (validation.ok && validation.restoredText) {
        const balance = await commitReservation(identity.userId, reservationId);
        logEvent("credit_commit", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, credits: cost });
        logEvent("transform_success", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, model, attempts: attempt, latencyMs: Date.now() - context.startedAt });
        const result: TransformResult = { version: "semantic-transform-v2", text: validation.restoredText, mode: parsed.mode, model, attempts: attempt, metrics: validation.metrics, warnings: validation.warnings, billing: { operationId: parsed.operationId, reservationId, creditsCharged: cost, balanceAfter: balance.available } };
        return apiOk(context, result as unknown as Record<string, unknown>);
      }
      retryFeedback = validation.errors.map(item => `- ${item}`).join("\n");
    }
    await releaseReservation(identity.userId, reservationId, "validation_failed");
    logEvent("transform_validation_failure", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, attempts: MAX_ATTEMPTS });
    logEvent("reservation_release", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, status: "validation_failed" });
    return apiError(context, "validation_failed", "The edit did not pass factual-preservation checks. The credit hold was released.", 422);
  } catch {
    try { await releaseReservation(identity.userId, reservationId, "generation_failed"); logEvent("reservation_release", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, status: "generation_failed" }); } catch { /* TTL expiry remains final recovery. */ }
    logEvent("model_provider_error", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, model, latencyMs: Date.now() - context.startedAt });
    return apiError(context, "model_unavailable", "The editing service is temporarily unavailable. The credit hold was released or will expire automatically.", 503);
  }
}
