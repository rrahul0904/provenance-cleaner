import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEVELOPER_API_KEY_PREFIX = "pc_sk_";
const MAX_ACTIVE_KEYS = 10;

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult> };
export type DeveloperApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
export type DeveloperIdentity = { userId: string; keyId: string; prefix: string };

function client() { return createAdminClient() as unknown as RpcClient; }
function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function stringValue(value: unknown) { return typeof value === "string" ? value : null; }
function mapKey(value: unknown): DeveloperApiKeySummary | null {
  const item = record(value);
  if (!item) return null;
  const id = stringValue(item.id);
  const name = stringValue(item.name);
  const prefix = stringValue(item.prefix);
  const createdAt = stringValue(item.createdAt);
  if (!id || !name || !prefix || !createdAt) return null;
  return {
    id,
    name,
    prefix,
    createdAt,
    lastUsedAt: stringValue(item.lastUsedAt),
    revokedAt: stringValue(item.revokedAt),
  };
}
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export function developerApiKeyHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function generateDeveloperApiKeyMaterial() {
  const secret = `${DEVELOPER_API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 17), hash: developerApiKeyHash(secret) };
}

export function developerBearerToken(request: Pick<Request, "headers">) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  if (!match) return null;
  const token = match[1].trim();
  if (!token.startsWith(DEVELOPER_API_KEY_PREFIX) || token.length < 35 || token.length > 100) return null;
  return token;
}

export async function createDeveloperApiKey(userId: string, name: string) {
  const material = generateDeveloperApiKeyMaterial();
  const data = record(await rpc("developer_api_key_create", {
    p_user_id: userId,
    p_name: name,
    p_prefix: material.prefix,
    p_hash: material.hash,
  }));
  if (!data) throw new Error("developer_api_key_create_failed");
  const summary = mapKey({ ...data, lastUsedAt: null, revokedAt: null });
  if (!summary) throw new Error("developer_api_key_create_invalid_response");
  return { ...summary, secret: material.secret };
}

export async function listDeveloperApiKeys(userId: string) {
  const data = await rpc("developer_api_key_list", { p_user_id: userId });
  if (!Array.isArray(data)) return [];
  return data.map(mapKey).filter((item): item is DeveloperApiKeySummary => Boolean(item));
}

export async function revokeDeveloperApiKey(userId: string, keyId: string) {
  return (await rpc("developer_api_key_revoke", { p_user_id: userId, p_key_id: keyId })) === true;
}

export async function authenticateDeveloperRequest(request: Pick<Request, "headers">): Promise<DeveloperIdentity | null> {
  const token = developerBearerToken(request);
  if (!token) return null;
  const data = record(await rpc("developer_api_key_resolve", { p_hash: developerApiKeyHash(token) }));
  if (!data) return null;
  const userId = stringValue(data.userId);
  const keyId = stringValue(data.keyId);
  const prefix = stringValue(data.prefix);
  return userId && keyId && prefix ? { userId, keyId, prefix } : null;
}

export async function getDeveloperPhase9Status() {
  return record(await rpc("developer_phase9_status"));
}

export { MAX_ACTIVE_KEYS };
