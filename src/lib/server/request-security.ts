const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CrossSiteMutationReason = "origin_mismatch" | "sec_fetch_site_cross_site";

export function crossSiteMutationReason(request: Request): CrossSiteMutationReason | null {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return null;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") return "sec_fetch_site_cross_site";

  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;

  try {
    const supplied = new URL(origin).origin;
    const target = new URL(request.url).origin;
    return supplied === target ? null : "origin_mismatch";
  } catch {
    return "origin_mismatch";
  }
}
