import { apiOk, requestContext } from "@/lib/server/api";
import { readinessSummary } from "@/lib/server/env";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = requestContext(request, "/api/readiness");
  const readiness = readinessSummary();
  return apiOk(context, { status: readiness.ready ? "ready" : "not_ready", checks: readiness.checks, missing: readiness.missing }, readiness.ready ? 200 : 503, { "cache-control": "no-store" });
}
