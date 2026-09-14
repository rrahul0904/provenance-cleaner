export type ReleaseHealth = {
  status?: string | null;
  commitSha?: string | null;
};

export type ReleaseReadiness = {
  status?: string | null;
  missing?: unknown;
};

export type ReleaseIntegrityReport = {
  ok: boolean;
  expectedSha: string | null;
  actualSha: string | null;
  healthStatus: string | null;
  readinessStatus: string | null;
  missing: string[];
  issues: string[];
};

export type DeploymentIntegrityReport = ReleaseIntegrityReport & {
  attempt: number;
  origin: string;
};

export function normalizeOrigin(value: unknown): string;
export function normalizeCommitSha(value: unknown): string;
export function assessReleaseIntegrity(input: {
  expectedSha: unknown;
  health?: ReleaseHealth | null;
  readiness?: ReleaseReadiness | null;
}): ReleaseIntegrityReport;
export function fetchJson(
  url: string,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<Record<string, unknown>>;
export function verifyDeployment(input: {
  origin: string;
  expectedSha: string;
  attempts?: number | string;
  delayMs?: number | string;
  fetchImpl?: typeof fetch;
}): Promise<DeploymentIntegrityReport>;
