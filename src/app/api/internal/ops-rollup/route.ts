import { timingSafeEqual } from "node:crypto";
import { rollupDailyMetrics } from "@/lib/billing/server";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
export const runtime="nodejs";
function authorized(request:Request){const secret=process.env.CRON_SECRET??"";const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/iu,"")??"";const a=Buffer.from(secret);const b=Buffer.from(supplied);return Boolean(secret&&supplied&&a.length===b.length&&timingSafeEqual(a,b));}
export async function GET(request:Request){const context=requestContext(request,"/api/internal/ops-rollup");if(!authorized(request))return apiError(context,"unauthorized","Not authorized.",401);try{const date=new Date(Date.now()-86_400_000).toISOString().slice(0,10);const result=await rollupDailyMetrics(date,context.requestId);return apiOk(context,{rolledUp:true,date,result});}catch{return apiError(context,"rollup_failed","Daily operations rollup failed.",503);}}
