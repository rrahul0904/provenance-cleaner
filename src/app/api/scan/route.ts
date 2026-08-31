import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeText, scanText } from "@/lib/provenance/unicode";

const RequestSchema = z.object({
  text: z.string().max(250_000),
  sanitize: z.enum(["none", "conservative", "aggressive"]).default("none"),
});

export async function POST(request: Request) {
  const payload = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid request", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const receipt = scanText(payload.data.text);
  const sanitation = payload.data.sanitize === "none"
    ? null
    : sanitizeText(payload.data.text, payload.data.sanitize);

  return NextResponse.json({ receipt, sanitation });
}
