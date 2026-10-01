const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CrossSiteMutationReason = "origin_mismatch" | "sec_fetch_site_cross_site";

function isDeveloperBearerRequest(request: Request) {
  const path = new URL(request.url).pathname;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return path.startsWith("/api/v1/") && /^Bearer\s+\S+$/iu.test(authorization);
}

function effectiveRequestOrigin(request: Request) {
  const target = new URL(request.url);
  const host = request.headers.get("host")?.trim();
  // Vercel replaces this header at its trusted edge. Ignore caller-supplied
  // forwarding metadata elsewhere so it cannot change the protocol check.
  const forwardedProtocol = process.env.VERCEL === "1"
    ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase()
    : undefined;
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : target.protocol.slice(0, -1);
  return new URL(`${protocol}://${host || target.host}`).origin;
}

export function crossSiteMutationReason(request: Request): CrossSiteMutationReason | null {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return null;

  // Developer APIs authenticate with revocable Bearer keys rather than browser
  // cookies. Chrome-extension and other approved API clients may legitimately
  // have a non-site Origin, so let the route's Bearer authentication decide.
  if (isDeveloperBearerRequest(request)) return null;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") return "sec_fetch_site_cross_site";

  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;

  try {
    const supplied = new URL(origin).origin;
    const target = effectiveRequestOrigin(request);
    return supplied === target ? null : "origin_mismatch";
  } catch {
    return "origin_mismatch";
  }
}
