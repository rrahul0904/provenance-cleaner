import { z } from "zod";
import { getRequestIdentity } from "@/lib/auth/identity";
import { cancelAccountDeletion, finalizeAccountDeletion, getPhase6Status, prepareAccountDeletion } from "@/lib/billing/server";
import { ApiRequestError, apiError, apiOk, parseJson, requestContext } from "@/lib/server/api";
import { logEvent, requestSubjectKey } from "@/lib/server/observability";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
const schema=z.object({confirmation:z.literal("DELETE")});
const REQUIRED_PHASE6_SCHEMA="20260902034500";
function isReady(value:unknown){return Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&(value as Record<string,unknown>).ready===true&&(value as Record<string,unknown>).schemaVersion===REQUIRED_PHASE6_SCHEMA);}

export async function POST(request:Request){
  const context=requestContext(request,"/api/account/delete");
  let identity:Awaited<ReturnType<typeof getRequestIdentity>>|null=null;
  let prepared=false;
  try{
    const parsed=await parseJson(request,schema,2_048);
    if(parsed.confirmation!=="DELETE")return apiError(context,"confirmation_required","Type DELETE to confirm account deletion.",400);
    identity=await getRequestIdentity();
    if(!identity)return apiError(context,"auth_required","Sign in before deleting an account.",401);
    if(!isReady(await getPhase6Status()))return apiError(context,"deletion_unavailable","Account deletion is not ready until the final billing migration is verified.",503);
    const userIdHash=requestSubjectKey(request,identity.userId);
    await prepareAccountDeletion(identity.userId);prepared=true;
    const admin=createAdminClient();
    const {error}=await admin.auth.admin.deleteUser(identity.userId);
    if(error){
      try{await cancelAccountDeletion(identity.userId);prepared=false;}catch{/* outer catch retries; cron clears a stale marker if both attempts fail */}
      throw error;
    }
    let reconciliationPending=false;
    try{await finalizeAccountDeletion(identity.userId);prepared=false;}catch{reconciliationPending=true;prepared=false;}
    logEvent("account_deleted",{requestId:context.requestId,userIdHash,reconciliationPending});
    return apiOk(context,{deleted:true,reconciliationPending});
  }catch(error){
    if(error instanceof ApiRequestError)return apiError(context,error.code,error.message,error.status);
    if(prepared&&identity){try{await cancelAccountDeletion(identity.userId);prepared=false;}catch{/* cron safely cancels stale pending deletion when the Auth identity still exists */}}
    logEvent("account_delete_failed",{requestId:context.requestId,subjectHash:requestSubjectKey(request)});
    return apiError(context,"account_delete_failed","Account deletion could not be completed.",503);
  }
}
