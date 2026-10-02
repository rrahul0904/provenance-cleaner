import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { crossSiteMutationReason } from "@/lib/server/request-security";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const crossSite = crossSiteMutationReason(request);
  if (crossSite) {
    return NextResponse.json(
      { error: { code: "cross_site_request_blocked", message: "Cross-site mutation requests are not allowed." } },
      {
        status: 403,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
