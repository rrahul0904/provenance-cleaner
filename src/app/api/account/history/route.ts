import { getAccountHistory } from "@/lib/billing/server";
import { getRequestIdentity } from "@/lib/auth/identity";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = requestContext(request, "/api/account/history");
  try {
    const identity = await getRequestIdentity();
    if (!identity) return apiError(context, "auth_required", "Sign in or start a guest session to view credit history.", 401);
    const history = await getAccountHistory(identity.userId, 100);
    return apiOk(context, { history });
  } catch {
    logEvent("account_history_failed", { requestId: context.requestId, subjectHash: requestSubjectKey(request) });
    return apiError(context, "account_history_unavailable", "Account history is temporarily unavailable.", 503);
  }
}
