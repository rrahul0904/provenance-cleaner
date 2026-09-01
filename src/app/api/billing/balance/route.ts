import { NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/auth/identity";
import { initializeCreditAccount } from "@/lib/billing/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const identity = await getRequestIdentity(); if (!identity) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try { return NextResponse.json({ balance: await initializeCreditAccount(identity.userId), isAnonymous: identity.isAnonymous }); }
  catch (error) { return NextResponse.json({ error: "Billing is not configured yet.", technical: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined }, { status: 503 }); }
}
