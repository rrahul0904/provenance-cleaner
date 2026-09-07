import { applyAuthCookies, createClient, type AuthCookie } from "@/lib/supabase/server";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

export async function POST(request: Request) {
  const context = requestContext(request, "/api/auth/signout");
  const authCookies: AuthCookie[] = [];
  try { const supabase = await createClient((cookiesToSet) => authCookies.push(...cookiesToSet)); await supabase.auth.signOut(); logEvent("signout", { requestId: context.requestId }); return applyAuthCookies(apiOk(context, { ok: true }), authCookies); }
  catch { return apiError(context, "account_unavailable", "Sign out could not be completed.", 503); }
}
