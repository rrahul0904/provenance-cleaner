import { getRequestIdentity } from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, requestContext } from "@/lib/server/api";
export const dynamic="force-dynamic";
export async function GET(request:Request){const context=requestContext(request,"/api/account/subscription");const identity=await getRequestIdentity();if(!identity)return apiError(context,"auth_required","Sign in to view subscription status.",401);try{const {data}=await createAdminClient().rpc("billing_get_account_subscription",{p_user_id:identity.userId});return apiOk(context,{subscription:data??{}});}catch{return apiError(context,"subscription_unavailable","Subscription status is unavailable.",503);}}
