import { isDevelopmentTurnstileBypass } from "@/lib/server/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[]; }
export interface ChallengeResult { ok: boolean; reason?: "missing_token" | "not_configured" | "verification_failed" | "action_mismatch"; bypassed?: boolean; }

export async function verifyTurnstile(token: string | undefined, expectedAction: string, fetcher: typeof fetch = fetch): Promise<ChallengeResult> {
  if (isDevelopmentTurnstileBypass() && token === "dev-bypass") return { ok: true, bypassed: true };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!token || token.length > 2048) return { ok: false, reason: "missing_token" };
  try {
    const response = await fetcher(VERIFY_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret, response: token }) });
    if (!response.ok) return { ok: false, reason: "verification_failed" };
    const result = await response.json() as TurnstileResponse;
    if (!result.success) return { ok: false, reason: "verification_failed" };
    if (result.action && result.action !== expectedAction) return { ok: false, reason: "action_mismatch" };
    return { ok: true };
  } catch { return { ok: false, reason: "verification_failed" }; }
}
