import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/identity";
import { CREDIT_PACKS } from "@/lib/billing/catalog";
import { getServerCreditPack } from "@/lib/billing/config";
import { attachCheckoutSession, createPendingPurchase } from "@/lib/billing/server";
import { getStripe } from "@/lib/billing/stripe";
export const runtime = "nodejs";
const schema = z.object({ packId: z.enum(["starter", "plus", "pro"]) });
export async function POST(request: Request) {
  const identity = await getRequestIdentity(); if (!identity) return NextResponse.json({ error: "Start a guest session or sign in before buying credits." }, { status: 401 });
  let parsed: z.infer<typeof schema>; try { parsed = schema.parse(await request.json()); } catch { return NextResponse.json({ error: "Unknown credit pack." }, { status: 400 }); }
  try {
    const pack = getServerCreditPack(parsed.packId); const purchaseId = crypto.randomUUID();
    await createPendingPurchase({ purchaseId, userId: identity.userId, packId: pack.id, credits: pack.credits, priceId: pack.priceId });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin; const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({ mode: "payment", line_items: [{ price: pack.priceId, quantity: 1 }], client_reference_id: purchaseId, metadata: { purchase_id: purchaseId, user_id: identity.userId, pack_id: pack.id, credits: String(pack.credits) }, success_url: `${origin}/?checkout=success`, cancel_url: `${origin}/?checkout=cancelled` }, { idempotencyKey: `credit-purchase:${purchaseId}` });
    if (!session.url) throw new Error("Stripe did not return a Checkout URL."); await attachCheckoutSession(purchaseId, identity.userId, session.id);
    return NextResponse.json({ url: session.url, pack: CREDIT_PACKS[parsed.packId] });
  } catch (error) { return NextResponse.json({ error: "Checkout is not configured yet.", technical: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined }, { status: 503 }); }
}
