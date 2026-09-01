import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/identity";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({ confirmation: z.literal("DELETE") });

export async function POST(request: Request) {
  const context = requestContext(request, "/api/account/delete");
  try {
    const parsed = await parseJson(request, schema, 2_048);
    if (parsed.confirmation !== "DELETE") return apiError(context, "confirmation_required", "Type DELETE to confirm account deletion.", 400);
    const identity = await getRequestIdentity();
    if (!identity) return apiError(context, "auth_required", "Sign in before deleting an account.", 401);
    const userIdHash = requestSubjectKey(request, identity.userId);
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(identity.userId);
    if (error) throw error;
    logEvent("account_deleted", { requestId: context.requestId, userIdHash });
    return apiOk(context, { deleted: true });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    logEvent("account_delete_failed", { requestId: context.requestId, subjectHash: requestSubjectKey(request) });
    return apiError(context, "account_delete_failed", "Account deletion could not be completed.", 503);
  }
}
