import { apiOk, requestContext } from "@/lib/server/api";
import { trackHealth } from "@/lib/server/pulseatlas";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = requestContext(request, "/api/health");
  const commitSha =
    process.env.NEXT_PUBLIC_BUILD_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    null;
  void trackHealth("ok");
  return apiOk(
    context,
    { status: "ok", version: packageJson.version, phase: 9, commitSha, nodeVersion: process.versions.node },
    200,
    { "cache-control": "no-store" },
  );
}
