import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializeCreditAccount } from "@/lib/billing/server";
export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const requestedNext = url.searchParams.get("next"); const next = requestedNext?.startsWith("/") ? requestedNext : "/";
  if (code) { const supabase = await createClient(); const { data, error } = await supabase.auth.exchangeCodeForSession(code); if (!error && data.user) { try { await initializeCreditAccount(data.user.id); } catch { /* auth remains valid if billing is not configured */ } } }
  return NextResponse.redirect(new URL(next, url.origin));
}
