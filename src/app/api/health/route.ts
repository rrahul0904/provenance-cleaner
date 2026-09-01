import { apiOk, requestContext } from "@/lib/server/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = requestContext(request, "/api/health");
  return apiOk(context, { status: "ok", version: "0.5.1", phase: 5 }, 200, { "cache-control": "no-store" });
}
