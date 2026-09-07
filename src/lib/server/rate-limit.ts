interface Bucket { count: number; resetAt: number; }
interface RateResult { allowed: boolean; remaining: number; retryAfterSeconds: number; }
declare global { var __provenanceRateBuckets: Map<string, Bucket> | undefined; }
const buckets = globalThis.__provenanceRateBuckets ??= new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function makeRoom(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  if (buckets.size < MAX_BUCKETS) return;
  let oldestKey: string | undefined;
  let oldestReset = Number.POSITIVE_INFINITY;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < oldestReset) { oldestReset = bucket.resetAt; oldestKey = key; }
  }
  if (oldestKey) buckets.delete(oldestKey);
}

export function consumeRateLimit(namespace: string, subject: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  if (limit <= 0) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, retryAfterSeconds: 0 };
  const key = `${namespace}:${subject}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (!current) makeRoom(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0 };
}
export function configuredLimit(name: string, fallback: number) { const value = Number.parseInt(process.env[name] ?? "", 10); return Number.isFinite(value) && value >= 0 ? value : fallback; }
export function resetRateLimitsForTests() { buckets.clear(); }
export function rateLimitBucketCountForTests() { return buckets.size; }
