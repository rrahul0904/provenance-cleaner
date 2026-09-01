import { timingSafeEqual } from "node:crypto";
import { expireStaleReservations, reconcileDeletedSubjects } from "@/lib/billing/server";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
import { logEvent } from "@/lib/server/observability";

export const runtime="nodejs";
function authorized(request:Request){const secret=process.env.CRON_SECRET;const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/iu,"")??"";if(!secret||!supplied)return false;const a=Buffer.from(secret);const b=Buffer.from(supplied);return a.length===b.length&&timingSafeEqual(a,b);}
function count(value:unknown,key:string){return value&&typeof value==="object"&&!Array.isArray(value)?Number((value as Record<string,unknown>)[key]??0):0;}
export async function GET(request:Request){const context=requestContext(request,"/api/internal/reconcile");if(!authorized(request))return apiError(context,"unauthorized","Not authorized.",401);try{const reservations=await expireStaleReservations(200);let deletions:unknown={finalized:0};try{deletions=await reconcileDeletedSubjects(200);}catch{/* Phase 6 is also enforced by readiness; keep stale reservation recovery independent. */}const expired=count(reservations,"expired");const finalizedDeleted=count(deletions,"finalized");logEvent("billing_reconciliation",{requestId:context.requestId,expired,finalizedDeleted,latencyMs:Date.now()-context.startedAt});return apiOk(context,{reconciled:true,expired,finalizedDeleted});}catch{logEvent("reservation_reconciliation_failed",{requestId:context.requestId});return apiError(context,"reconciliation_failed","Reservation reconciliation failed.",503);}}
