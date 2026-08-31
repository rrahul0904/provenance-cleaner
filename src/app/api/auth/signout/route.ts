import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

export async function POST(request: Request) {
  const context = requestContext(request, "/api/auth/signout");
  try { const supabase = await createClient(); await supabase.auth.signOut(); logEvent("signout", { requestId: context.requestId }); return apiOk(context, { ok: true }); }
  catch { return apiError(context, "account_unavailable", "Sign out could not be completed.", 503); }
}
