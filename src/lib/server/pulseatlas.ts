type EventCategory = "product" | "health";
type SafeProperties = Record<string, string | number | boolean>;

const identity = { organizationId: "portfolio_primary", projectId: "proj_provenance_cleaner", projectSlug: "provenance-cleaner" } as const;

function environment() {
  const value = process.env.PULSEATLAS_ENVIRONMENT;
  return value === "development" || value === "preview" ? value : "production";
}

async function send(eventName: string, eventCategory: EventCategory, properties: SafeProperties): Promise<boolean> {
  const rawEndpoint = process.env.PULSEATLAS_ENDPOINT;
  const writeKey = process.env.PULSEATLAS_WRITE_KEY;
  if (!rawEndpoint || !writeKey) return false;
  try {
    const endpoint = new URL(rawEndpoint);
    const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1";
    if (endpoint.protocol !== "https:" && !local) return false;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-pulseatlas-write-key": writeKey },
      body: JSON.stringify({
        id: `evt_${crypto.randomUUID()}`,
        schemaVersion: 1,
        ...identity,
        environment: environment(),
        eventName,
        eventCategory,
        occurredAt: new Date().toISOString(),
        properties,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function trackInspectionCompleted(input: { fileType: string; operation: string; result: string }) {
  return send("inspection_completed", "product", { file_type: input.fileType, operation: input.operation, result: input.result });
}

export function trackHealth(status: "ok" | "degraded") {
  return send("health_check", "health", { component: "provenance-cleaner", status });
}
