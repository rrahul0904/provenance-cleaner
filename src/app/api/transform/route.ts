import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyTurnstile } from "@/lib/abuse/turnstile";
import { getRequestIdentity, type RequestIdentity } from "@/lib/auth/identity";
import { transformOperationKey } from "@/lib/billing/operation-key";
import { commitReservation, grantGuestPromoCredits, initializeCreditAccount, releaseReservation, reserveCredits } from "@/lib/billing/server";
import { BillingDomainError } from "@/lib/billing/types";
import { countWords, MAX_REWRITE_WORDS } from "@/lib/product-contract";
import { planSanitizationJob, SanitizationContractError } from "@/lib/sanitization";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext, retryAfter } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { configuredLimit, consumeRateLimit } from "@/lib/server/rate-limit";
import { applyAuthCookies, createClient, type AuthCookie } from "@/lib/supabase/server";
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
const PREVIEW_RELEASE_SMOKE_MARKER = "[[PROVENANCE_PREVIEW_RELEASE_SMOKE]]";

export const transformRequestSchema = z.object({
  operationId: z.string().uuid(),
  text: z.string().trim().min(20).max(250_000),
  mode: z.enum(TRANSFORM_MODES),
  intensity: z.enum(TRANSFORM_INTENSITIES).default("balanced"),
  purpose: z.enum(TRANSFORM_PURPOSES).default("general"),
  challengeToken: z.string().max(2048).optional(),
});

function wordBucket(words: number) {
  if (words <= 250) return "<=250";
  if (words <= 1_000) return "251-1000";
  if (words <= 4_000) return "1001-4000";
  return "4001-8000";
}
function charBucket(chars: number) {
  if (chars <= 2_000) return "<=2K";
  if (chars <= 10_000) return "2K-10K";
  if (chars <= 50_000) return "10K-50K";
  return ">50K";
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

async function ensureIdentityAfterChallenge(request: Request, authCookies: AuthCookie[]) {
  let identity: RequestIdentity | null;
  try {
    identity = await getRequestIdentity();
  } catch {
    throw new Error("account_unavailable");
  }
  if (identity) {
    if (identity.isAnonymous) await grantGuestPromoCredits(identity.userId);
    return identity;
  }

  const supabase = await createClient((cookiesToSet) => authCookies.push(...cookiesToSet));
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error("account_unavailable");
  await initializeCreditAccount(data.user.id);
  await grantGuestPromoCredits(data.user.id);
  logEvent("guest_session_created_for_transform", {
    requestId: request.headers.get("x-request-id") ?? undefined,
    userIdHash: requestSubjectKey(request, data.user.id),
  });
  return {
    userId: data.user.id,
    isAnonymous: true,
    email: null,
    emailVerified: false,
  } satisfies RequestIdentity;
}

export async function POST(request: Request) {
  const context = requestContext(request, "/api/transform");

  let parsed: z.infer<typeof transformRequestSchema>;
  try {
    parsed = await parseJson(request, transformRequestSchema, 300_000);
  } catch (error) {
    return error instanceof ApiRequestError
      ? apiError(context, error.code, error.message, error.status)
      : apiError(context, "invalid_request", "Request is invalid.", 400);
  }

  let job;
  try {
    job = planSanitizationJob({ kind: "text", intent: "rewrite", text: parsed.text });
  } catch (error) {
    if (error instanceof SanitizationContractError && error.code === "rewrite_too_large") {
      return apiError(context, "rewrite_too_large", `Semantic editing accepts at most ${MAX_REWRITE_WORDS.toLocaleString("en-US")} words per operation. Split larger documents into parts.`, 413);
    }
    return apiError(context, "invalid_request", "The rewrite job does not satisfy the product contract.", 400);
  }

  const preAuthSubject = requestSubjectKey(request);
  const preAuthBurst = consumeRateLimit("transform-attempt", preAuthSubject, configuredLimit("RATE_LIMIT_TRANSFORM_PER_MINUTE", 8), 60_000);
  if (!preAuthBurst.allowed) return apiError(context, "rate_limited", "Too many edit requests. Try again shortly.", 429, retryAfter(preAuthBurst.retryAfterSeconds));

  const challenge = await verifyTurnstile(parsed.challengeToken, "transform");
  if (!challenge.ok) {
    logEvent("bot_challenge_failed", { requestId: context.requestId, route: context.route, subjectHash: preAuthSubject, reason: challenge.reason ?? "unknown" });
    return apiError(
      context,
      challenge.reason === "not_configured" ? "bot_protection_unavailable" : "bot_challenge_failed",
      challenge.reason === "not_configured" ? "Bot protection is not configured." : "Bot verification is required.",
      challenge.reason === "not_configured" ? 503 : 403,
    );
  }

  const authCookies: AuthCookie[] = [];
  const respond = (response: NextResponse) => authCookies.length ? applyAuthCookies(response, authCookies) : response;
  let identity: RequestIdentity;
  try {
    identity = await ensureIdentityAfterChallenge(request, authCookies);
  } catch {
    return respond(apiError(context, "account_unavailable", "Account service is not available.", 503));
  }

  const subject = requestSubjectKey(request, identity.userId);
  const burst = consumeRateLimit("transform-account", subject, configuredLimit("RATE_LIMIT_TRANSFORM_PER_MINUTE", 8), 60_000);
  if (!burst.allowed) return respond(apiError(context, "rate_limited", "Too many edit requests. Try again shortly.", 429, retryAfter(burst.retryAfterSeconds)));

  const cost = job.credits;
  const sourceWords = countWords(parsed.text);
  logEvent("transform_request", {
    requestId: context.requestId,
    userIdHash: subject,
    operationId: parsed.operationId,
    sourceSizeBucket: charBucket(parsed.text.length),
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
    if (!reservation.created || reservation.status !== "reserved") {
      return respond(apiError(context, "operation_conflict", "This edit operation is already in progress or complete.", 409));
    }
    logEvent("credit_reservation", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, credits: cost });
  } catch (error) {
    if (error instanceof BillingDomainError) return respond(billingError(context, error));
    return respond(apiError(context, "billing_unavailable", "Billing is not available.", 503));
  }

  const prepared = prepareProtectedText(parsed.text);
  const model = process.env.TRANSFORM_MODEL ?? DEFAULT_MODEL;
  const injectPreviewFailure = process.env.VERCEL_ENV === "preview" && parsed.text.includes(PREVIEW_RELEASE_SMOKE_MARKER);
  let retryFeedback: string | undefined;

  try {
    if (injectPreviewFailure) throw new Error("controlled_preview_release_smoke");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const draft = await generateAttempt(prepared.protectedText, parsed.mode, parsed.intensity, parsed.purpose, model, retryFeedback);
      const validation = validateTransformedDraft(prepared, draft, parsed.mode);
      if (validation.ok && validation.restoredText) {
        const balance = await commitReservation(identity.userId, reservationId);
        const watermark = await unavailableTextWatermarkVerifier.verify(validation.restoredText);
        logEvent("credit_commit", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, credits: cost });
        logEvent("transform_success", {
          requestId: context.requestId,
          userIdHash: subject,
          operationId: parsed.operationId,
          model,
          attempts: attempt,
          intensity: parsed.intensity,
          purpose: parsed.purpose,
          latencyMs: Date.now() - context.startedAt,
        });
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
        return respond(apiOk(context, result as unknown as Record<string, unknown>));
      }
      retryFeedback = validation.errors.map((item) => `- ${item}`).join("\n");
    }

    await releaseReservation(identity.userId, reservationId, "validation_failed");
    logEvent("transform_validation_failure", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, attempts: MAX_ATTEMPTS });
    return respond(apiError(context, "validation_failed", "The edit did not pass factual-preservation checks. The credit hold was released.", 422));
  } catch {
    try { await releaseReservation(identity.userId, reservationId, "generation_failed"); } catch {}
    logEvent("model_provider_error", { requestId: context.requestId, userIdHash: subject, operationId: parsed.operationId, model, latencyMs: Date.now() - context.startedAt });
    return respond(apiError(context, "model_unavailable", "The editing service is temporarily unavailable. The credit hold was released or will expire automatically.", 503));
  }
}
