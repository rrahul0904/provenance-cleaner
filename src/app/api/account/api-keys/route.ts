import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/identity";
import { createDeveloperApiKey, listDeveloperApiKeys, revokeDeveloperApiKey } from "@/lib/developer-api";
import { ApiRequestError, apiError, apiOk, crossSiteMutationError, parseJson, requestContext } from "@/lib/server/api";
import { consumeRateLimit } from "@/lib/server/rate-limit";

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });
const revokeSchema = z.object({ id: z.string().uuid() });

async function verifiedIdentity(context: ReturnType<typeof requestContext>) {
  try {
    const identity = await getRequestIdentity();
    if (!identity) return { error: apiError(context, "auth_required", "Sign in before managing developer API keys.", 401) };
    if (identity.isAnonymous || !identity.emailVerified) return { error: apiError(context, "verified_account_required", "A verified account is required for developer API keys.", 403) };
    return { identity };
  } catch {
    return { error: apiError(context, "account_unavailable", "Account service is not available.", 503) };
  }
}

export async function GET(request: Request) {
  const context = requestContext(request, "/api/account/api-keys");
  const resolved = await verifiedIdentity(context);
  if (resolved.error) return resolved.error;
  try {
    const keys = await listDeveloperApiKeys(resolved.identity.userId);
    return apiOk(context, { keys });
  } catch {
    return apiError(context, "developer_api_unavailable", "Developer API key service is unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const context = requestContext(request, "/api/account/api-keys");
  const crossSite = crossSiteMutationError(request, context);
  if (crossSite) return crossSite;
  const resolved = await verifiedIdentity(context);
  if (resolved.error) return resolved.error;
  const limit = consumeRateLimit("developer-key-create", resolved.identity.userId, 5, 60_000);
  if (!limit.allowed) return apiError(context, "rate_limited", "Too many API key changes. Try again shortly.", 429);
  try {
    const body = await parseJson(request, createSchema);
    const key = await createDeveloperApiKey(resolved.identity.userId, body.name);
    return apiOk(context, { key, secretShownOnce: true }, 201, { "cache-control": "no-store" });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("developer_api_key_limit")) return apiError(context, "api_key_limit", "Revoke an existing key before creating another.", 409);
    return apiError(context, "developer_api_unavailable", "Developer API key could not be created.", 503);
  }
}

export async function DELETE(request: Request) {
  const context = requestContext(request, "/api/account/api-keys");
  const crossSite = crossSiteMutationError(request, context);
  if (crossSite) return crossSite;
  const resolved = await verifiedIdentity(context);
  if (resolved.error) return resolved.error;
  const limit = consumeRateLimit("developer-key-revoke", resolved.identity.userId, 10, 60_000);
  if (!limit.allowed) return apiError(context, "rate_limited", "Too many API key changes. Try again shortly.", 429);
  try {
    const body = await parseJson(request, revokeSchema);
    const revoked = await revokeDeveloperApiKey(resolved.identity.userId, body.id);
    if (!revoked) return apiError(context, "api_key_not_found", "API key was not found or was already revoked.", 404);
    return apiOk(context, { revoked: true });
  } catch (error) {
    if (error instanceof ApiRequestError) return apiError(context, error.code, error.message, error.status);
    return apiError(context, "developer_api_unavailable", "Developer API key could not be revoked.", 503);
  }
}
