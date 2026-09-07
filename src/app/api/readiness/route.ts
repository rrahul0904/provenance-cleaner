import { getPhase6Status } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiOk, requestContext } from "@/lib/server/api";
import { readinessSummary } from "@/lib/server/env";

export const dynamic = "force-dynamic";
const REQUIRED_PHASE6_SCHEMA = "20260902034500";
const REQUIRED_PHASE7_SCHEMA = "20260903144643";

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function GET(request: Request) {
  const context = requestContext(request, "/api/readiness");
  const env = readinessSummary(request);

  let phase6: Record<string, unknown> | null = null;
  try { phase6 = record(await getPhase6Status()); } catch { phase6 = null; }
  const phase6Ready = phase6?.ready === true && phase6.schemaVersion === REQUIRED_PHASE6_SCHEMA;

  let phase7: Record<string, unknown> | null = null;
  try {
    const { data, error } = await createAdminClient().rpc("ops_admin_dashboard", { p_days: 1 });
    if (!error) phase7 = record(data);
  } catch { phase7 = null; }
  const phase7Ready = phase7?.schemaVersion === REQUIRED_PHASE7_SCHEMA;

  let adminStatus: Record<string, unknown> | null = null;
  try {
    const { data, error } = await createAdminClient().rpc("ops_admin_status");
    if (!error) adminStatus = record(data);
  } catch { adminStatus = null; }
  const adminOwnerReady = adminStatus?.ownerConfigured === true;

  const checks = {
    ...env.checks,
    adminOwner: { configured: adminOwnerReady, required: true },
    phase6Schema: { configured: phase6Ready, required: true },
    phase7Schema: { configured: phase7Ready, required: true },
  };
  const missing = [
    ...env.missing,
    ...(adminOwnerReady ? [] : ["adminOwner"]),
    ...(phase6Ready ? [] : ["phase6Schema"]),
    ...(phase7Ready ? [] : ["phase7Schema"]),
  ];
  const ready = missing.length === 0;

  return apiOk(context, {
    status: ready ? "ready" : "not_ready",
    checks,
    missing,
    phase6: phase6 ? {
      ready: phase6Ready,
      schemaVersion: phase6.schemaVersion,
      balanceLotMismatches: phase6.balanceLotMismatches,
      deletionReconciliationPending: phase6.deletionReconciliationPending,
      staleDeletionCancellationPending: phase6.staleDeletionCancellationPending,
    } : null,
    phase7: phase7 ? {
      ready: phase7Ready,
      schemaVersion: phase7.schemaVersion,
    } : null,
    admin: {
      ready: adminOwnerReady,
      ownerConfigured: adminOwnerReady,
    },
  }, ready ? 200 : 503, { "cache-control": "no-store" });
}
