import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/identity";
import { creditCostForText } from "@/lib/billing/catalog";
import { commitReservation, releaseReservation, reserveCredits } from "@/lib/billing/server";
import { BillingDomainError } from "@/lib/billing/types";
import { chunkProtectedText, prepareProtectedText, TRANSFORM_MODES, TRANSFORM_SYSTEM, transformPrompt, validateTransformedDraft } from "@/lib/transform";
import type { TransformMode, TransformResult } from "@/lib/transform";
export const runtime = "nodejs";
const DEFAULT_MODEL = "mistral/mistral-medium-3.5"; const MAX_ATTEMPTS = 2;
const bodySchema = z.object({ operationId: z.string().uuid(), text: z.string().min(20).max(12_000), mode: z.enum(TRANSFORM_MODES) });
async function generateAttempt(protectedText: string, mode: TransformMode, model: string, retryFeedback?: string) {
  const outputs: string[] = []; for (const chunk of chunkProtectedText(protectedText)) { const { text } = await generateText({ model, system: TRANSFORM_SYSTEM, prompt: transformPrompt(chunk, mode, retryFeedback), temperature: 0.3 }); outputs.push(text.trim()); } return outputs.join("\n\n");
}
function billingErrorResponse(error: BillingDomainError) {
  if (error.code === "insufficient_credits") return NextResponse.json({ error: error.message, code: error.code }, { status: 402 });
  if (error.code === "rate_limited" || error.code === "daily_credit_limit") return NextResponse.json({ error: error.message, code: error.code }, { status: 429 });
  if (error.code === "operation_conflict") return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  return NextResponse.json({ error: "Billing is not available yet." }, { status: 503 });
}
export async function POST(request: Request) {
  const identity = await getRequestIdentity(); if (!identity) return NextResponse.json({ error: "Start a guest session or sign in before running a semantic edit.", code: "auth_required" }, { status: 401 });
  let parsed: z.infer<typeof bodySchema>; try { parsed = bodySchema.parse(await request.json()); } catch (error) { return NextResponse.json({ error: "Invalid request. Provide an operation id, 20–12,000 characters, and a supported edit mode.", details: error instanceof z.ZodError ? error.issues : undefined }, { status: 400 }); }
  const cost = creditCostForText(parsed.text); let reservationId: string;
  try { const reservation = await reserveCredits(identity.userId, `transform:${parsed.operationId}`, cost); reservationId = reservation.reservationId; if (!reservation.created || reservation.status !== "reserved") return NextResponse.json({ error: "This edit operation is already in progress or has already completed. Start a new edit to continue.", code: "operation_conflict" }, { status: 409 }); }
  catch (error) { if (error instanceof BillingDomainError) return billingErrorResponse(error); return NextResponse.json({ error: "Billing is not available yet." }, { status: 503 }); }
  const prepared = prepareProtectedText(parsed.text); const model = process.env.TRANSFORM_MODEL ?? DEFAULT_MODEL; let retryFeedback: string | undefined; let lastErrors: string[] = [];
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) { const draft = await generateAttempt(prepared.protectedText, parsed.mode, model, retryFeedback); const validation = validateTransformedDraft(prepared, draft, parsed.mode); if (validation.ok && validation.restoredText) { const balance = await commitReservation(identity.userId, reservationId); const result: TransformResult = { version: "semantic-transform-v2", text: validation.restoredText, mode: parsed.mode, model, attempts: attempt, metrics: validation.metrics, warnings: validation.warnings, billing: { operationId: parsed.operationId, reservationId, creditsCharged: cost, balanceAfter: balance.available } }; return NextResponse.json(result); } lastErrors = validation.errors; retryFeedback = validation.errors.map((item) => `- ${item}`).join("\n"); }
    await releaseReservation(identity.userId, reservationId, "validation_failed"); return NextResponse.json({ error: "The generated edit did not pass factual-preservation checks after retrying. The credit hold was released.", validationErrors: lastErrors }, { status: 422 });
  } catch (error) {
    try { await releaseReservation(identity.userId, reservationId, "generation_failed"); } catch { /* expiry is final recovery */ }
    const message = error instanceof Error ? error.message : "AI generation failed."; return NextResponse.json({ error: "The editing service is not available. The credit hold was released or will expire automatically.", technical: process.env.NODE_ENV === "development" ? message : undefined }, { status: 503 });
  }
}
