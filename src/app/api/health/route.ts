import { apiOk, requestContext } from "@/lib/server/api";
import { trackHealth } from "@/lib/server/pulseatlas";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = requestContext(request, "/api/health");
  void trackHealth("ok");
  return apiOk(context, { status: "ok", version: "0.5.1", phase: 5 }, 200, { "cache-control": "no-store" });
}
