import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  chunkProtectedText,
  prepareProtectedText,
  TRANSFORM_MODES,
  TRANSFORM_SYSTEM,
  transformPrompt,
  validateTransformedDraft,
} from "@/lib/transform";
import type { TransformMode, TransformResult } from "@/lib/transform";

export const runtime = "nodejs";

const DEFAULT_MODEL = "mistral/mistral-medium-3.5";
const MAX_ATTEMPTS = 2;

const bodySchema = z.object({
  text: z.string().min(20).max(12_000),
  mode: z.enum(TRANSFORM_MODES),
});

async function generateAttempt(protectedText: string, mode: TransformMode, model: string, retryFeedback?: string) {
  const chunks = chunkProtectedText(protectedText);
  const outputs: string[] = [];

  for (const chunk of chunks) {
    const { text } = await generateText({
      model,
      system: TRANSFORM_SYSTEM,
      prompt: transformPrompt(chunk, mode, retryFeedback),
      temperature: 0.3,
    });
    outputs.push(text.trim());
  }

  return outputs.join("\n\n");
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request. Provide 20–12,000 characters and a supported edit mode.", details: error instanceof z.ZodError ? error.issues : undefined },
      { status: 400 },
    );
  }

  const prepared = prepareProtectedText(parsed.text);
  const model = process.env.TRANSFORM_MODEL ?? DEFAULT_MODEL;
  let retryFeedback: string | undefined;
  let lastErrors: string[] = [];

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const draft = await generateAttempt(prepared.protectedText, parsed.mode, model, retryFeedback);
      const validation = validateTransformedDraft(prepared, draft, parsed.mode);

      if (validation.ok && validation.restoredText) {
        const result: TransformResult = {
          version: "semantic-transform-v1",
          text: validation.restoredText,
          mode: parsed.mode,
          model,
          attempts: attempt,
          metrics: validation.metrics,
          warnings: validation.warnings,
        };
        return NextResponse.json(result);
      }

      lastErrors = validation.errors;
      retryFeedback = validation.errors.map((item) => `- ${item}`).join("\n");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed.";
    return NextResponse.json(
      {
        error: "The editing service is not available yet. Configure Vercel AI Gateway/OIDC or AI_GATEWAY_API_KEY and try again.",
        technical: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "The generated edit did not pass factual-preservation checks after retrying.",
      validationErrors: lastErrors,
    },
    { status: 422 },
  );
}
