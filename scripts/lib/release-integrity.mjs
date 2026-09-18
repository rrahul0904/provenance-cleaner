const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/iu;
const SOURCE_HASH_PATTERN = /^[0-9a-f]{64}$/iu;
const REQUIRED_NODE_MAJOR = 24;

export function normalizeOrigin(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Production URL is required.");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Production URL must use http or https.");
  }
  return url.origin;
}

export function normalizeCommitSha(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeSourceHash(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function assessReleaseIntegrity({ expectedSha, expectedSourceHash, health, readiness }) {
  const expected = normalizeCommitSha(expectedSha);
  const actual = normalizeCommitSha(health?.commitSha);
  const expectedSource = normalizeSourceHash(expectedSourceHash);
  const actualSource = normalizeSourceHash(health?.sourceHash);
  const releaseId = String(health?.releaseId ?? "").trim();
  const nodeVersion = String(health?.nodeVersion ?? "").trim();
  const nodeMajor = Number.parseInt(nodeVersion.split(".")[0] ?? "", 10);
  const missing = Array.isArray(readiness?.missing)
    ? readiness.missing.filter((item) => typeof item === "string" && item.trim())
    : [];
  const issues = [];

  if (!COMMIT_SHA_PATTERN.test(expected)) {
    issues.push("expected SHA must be a full 40-character Git commit SHA");
  }
  if (!SOURCE_HASH_PATTERN.test(expectedSource)) {
    issues.push("expected source hash must be a 64-character SHA-256 value");
  }
  if (health?.status !== "ok") {
    issues.push(`health status is ${health?.status ?? "missing"}`);
  }
  if (!actualSource) {
    issues.push("deployed health response is missing sourceHash");
  } else if (SOURCE_HASH_PATTERN.test(expectedSource) && actualSource !== expectedSource) {
    issues.push(`deployed source hash ${actualSource} does not match expected source hash ${expectedSource}`);
  }
  if (actual) {
    if (!COMMIT_SHA_PATTERN.test(actual)) {
      issues.push("deployed commitSha is not a full 40-character Git commit SHA");
    } else if (COMMIT_SHA_PATTERN.test(expected) && actual !== expected) {
      issues.push(`deployed SHA ${actual} does not match expected SHA ${expected}`);
    }
  }
  if (!releaseId) {
    issues.push("deployed health response is missing releaseId");
  }
  if (!nodeVersion) {
    issues.push("deployed health response is missing nodeVersion");
  } else if (nodeMajor !== REQUIRED_NODE_MAJOR) {
    issues.push(`deployed Node.js major ${Number.isFinite(nodeMajor) ? nodeMajor : "invalid"} does not match required major ${REQUIRED_NODE_MAJOR}`);
  }
  if (readiness?.status !== "ready") {
    issues.push(`readiness status is ${readiness?.status ?? "missing"}`);
  }
  if (missing.length > 0) {
    issues.push(`readiness reports missing checks: ${missing.join(", ")}`);
  }

  return {
    ok: issues.length === 0,
    verificationMode: actual ? "commit-sha+source-hash" : "source-hash",
    expectedSha: expected || null,
    actualSha: actual || null,
    expectedSourceHash: expectedSource || null,
    actualSourceHash: actualSource || null,
    releaseId: releaseId || null,
    healthStatus: health?.status ?? null,
    nodeVersion: nodeVersion || null,
    readinessStatus: readiness?.status ?? null,
    missing,
    issues,
  };
}

export async function fetchJson(url, { fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(`${url} did not return a JSON object`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyDeployment({
  origin,
  expectedSha,
  expectedSourceHash,
  attempts = 1,
  delayMs = 0,
  fetchImpl = globalThis.fetch,
}) {
  const normalizedOrigin = normalizeOrigin(origin);
  const totalAttempts = Math.max(1, Number.parseInt(String(attempts), 10) || 1);
  const pauseMs = Math.max(0, Number.parseInt(String(delayMs), 10) || 0);
  let lastReport = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const [health, readiness] = await Promise.all([
        fetchJson(`${normalizedOrigin}/api/health`, { fetchImpl }),
        fetchJson(`${normalizedOrigin}/api/readiness`, { fetchImpl }),
      ]);
      lastReport = {
        attempt,
        origin: normalizedOrigin,
        ...assessReleaseIntegrity({ expectedSha, expectedSourceHash, health, readiness }),
      };
    } catch (error) {
      lastReport = {
        attempt,
        origin: normalizedOrigin,
        ok: false,
        verificationMode: null,
        expectedSha: normalizeCommitSha(expectedSha) || null,
        actualSha: null,
        expectedSourceHash: normalizeSourceHash(expectedSourceHash) || null,
        actualSourceHash: null,
        releaseId: null,
        healthStatus: null,
        nodeVersion: null,
        readinessStatus: null,
        missing: [],
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }

    if (lastReport.ok || attempt === totalAttempts) return lastReport;
    if (pauseMs > 0) await sleep(pauseMs);
  }

  return lastReport;
}
