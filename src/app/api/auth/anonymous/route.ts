import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializeCreditAccount } from "@/lib/billing/server";

export const runtime = "nodejs";
export async function POST() {
  try {
    const supabase = await createClient();
    const claims = await supabase.auth.getClaims();
    const existing = claims.data?.claims?.sub;
    if (typeof existing === "string") return NextResponse.json({ userId: existing, balance: await initializeCreditAccount(existing) });
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Could not create a guest session." }, { status: 503 });
    return NextResponse.json({ userId: data.user.id, balance: await initializeCreditAccount(data.user.id) });
  } catch (error) {
    return NextResponse.json({ error: "Account service is not configured yet.", technical: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined }, { status: 503 });
  }
}
