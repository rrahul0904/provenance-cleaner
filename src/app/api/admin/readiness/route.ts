import { createAdminClient } from "@/lib/supabase/admin";
import { apiOk, requestContext } from "@/lib/server/api";
import { readinessSummary } from "@/lib/server/env";

export const dynamic = "force-dynamic";

function record(value:unknown){return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}

export async function GET(request:Request){
  const context=requestContext(request,"/api/admin/readiness");
  const env=readinessSummary(request);

  let adminStatus:Record<string,unknown>|null=null;
  try{const {data,error}=await createAdminClient().rpc("ops_admin_status");if(!error)adminStatus=record(data);}catch{adminStatus=null;}

  const ownerConfigured=adminStatus?.ownerConfigured===true;
  const bootstrapConfigured=env.checks.adminOwnerBootstrap?.configured===true;
  const ready=ownerConfigured||bootstrapConfigured;

  return apiOk(context,{
    status:ready?"ready":"not_ready",
    checks:{
      adminOwner:{configured:ready,required:true},
      adminOwnerProvisioned:{configured:ownerConfigured,required:false},
      adminOwnerBootstrap:{configured:bootstrapConfigured,required:false},
    },
    missing:ready?[]:["adminOwner"],
    admin:{ready,ownerConfigured,bootstrapConfigured},
  },ready?200:503,{"cache-control":"no-store"});
}
