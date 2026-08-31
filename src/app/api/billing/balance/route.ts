import { getRequestIdentity } from "@/lib/auth/identity";
import { initializeCreditAccount } from "@/lib/billing/server";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = requestContext(request, "/api/billing/balance");
  try {
    const identity = await getRequestIdentity();
    if (!identity) return apiError(context, "auth_required", "Start a guest session or sign in first.", 401);
    const balance = await initializeCreditAccount(identity.userId);
    return apiOk(context, { balance, isAnonymous: identity.isAnonymous });
  } catch {
    logEvent("balance_unavailable", { requestId: context.requestId, route: context.route, subjectHash: requestSubjectKey(request) });
    return apiError(context, "billing_unavailable", "Billing is not available.", 503);
  }
}
