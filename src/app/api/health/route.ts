import { apiOk, requestContext } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = requestContext(request, "/api/health");
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.GITHUB_SHA?.trim() || null;
  return apiOk(
    context,
    { status: "ok", version: "0.5.1", phase: 5, commitSha },
    200,
    { "cache-control": "no-store" },
  );
}
