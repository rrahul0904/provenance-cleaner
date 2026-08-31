import { timingSafeEqual } from "node:crypto";
import { expireStaleReservations } from "@/lib/billing/server";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

export const runtime = "nodejs";
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function GET(request: Request) {
  const context = requestContext(request, "/api/internal/reconcile");
  if (!authorized(request)) return apiError(context, "unauthorized", "Not authorized.", 401);
  try {
    const result = await expireStaleReservations(200);
    logEvent("reservation_reconciliation", { requestId: context.requestId, expired: Number(result.expired ?? 0), latencyMs: Date.now() - context.startedAt });
    return apiOk(context, { reconciled: true, expired: Number(result.expired ?? 0) });
  } catch {
    logEvent("reservation_reconciliation_failed", { requestId: context.requestId });
    return apiError(context, "reconciliation_failed", "Reservation reconciliation failed.", 503);
  }
}
