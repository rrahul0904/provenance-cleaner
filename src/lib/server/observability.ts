import { createHash } from "node:crypto";

const SENSITIVE_KEY = /(authorization|cookie|secret|token|password|signature|raw|body|content|text|manifest|ip)$/iu;

type MetaValue = string | number | boolean | null | undefined;
export type OperationalMetadata = Record<string, MetaValue>;

export function hashIdentifier(value: string) {
  const salt = process.env.RATE_LIMIT_HASH_SALT || "local-development-only";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export function logEvent(event: string, metadata: OperationalMetadata = {}) {
  const safe: Record<string, MetaValue | "[redacted]"> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) safe[key] = "[redacted]";
    else if (typeof value === "string") safe[key] = value.slice(0, 200);
    else safe[key] = value;
  }
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), event, ...safe }));
}

export function requestSubjectKey(request: Request, userId?: string | null) {
  if (userId) return `user:${hashIdentifier(userId)}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return `ip:${hashIdentifier(forwarded || real || "unknown")}`;
}
