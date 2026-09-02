import { getPhase6Status } from "@/lib/billing/server";
import { apiOk, requestContext } from "@/lib/server/api";
import { readinessSummary } from "@/lib/server/env";

export const dynamic = "force-dynamic";
const REQUIRED_PHASE6_SCHEMA = "20260902034500";
function record(value: unknown) { return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null; }

export async function GET(request: Request) {
  const context=requestContext(request,"/api/readiness");
  const env=readinessSummary(request);
  let phase6:Record<string,unknown>|null=null;
  try { phase6=record(await getPhase6Status()); } catch { phase6=null; }
  const phase6Ready=phase6?.ready===true && phase6.schemaVersion===REQUIRED_PHASE6_SCHEMA;
  const checks={...env.checks,phase6Schema:{configured:phase6Ready,required:true}};
  const missing=[...env.missing,...(phase6Ready?[]:["phase6Schema"])];
  const ready=missing.length===0;
  return apiOk(context,{status:ready?"ready":"not_ready",checks,missing,phase6:phase6?{
    ready:phase6Ready,
    schemaVersion:phase6.schemaVersion,
    balanceLotMismatches:phase6.balanceLotMismatches,
    deletionReconciliationPending:phase6.deletionReconciliationPending,
    staleDeletionCancellationPending:phase6.staleDeletionCancellationPending,
  }:null},ready?200:503,{"cache-control":"no-store"});
}
