import { getRequestIdentity } from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole, type AdminRole } from "./permissions";

export type AdminSession = { userId: string; role: AdminRole };

type AdminRow = { authorized?: boolean; role?: string };
export async function getAdminSession(): Promise<AdminSession | null> {
  const identity = await getRequestIdentity();
  if (!identity || identity.isAnonymous) return null;
  const owner = process.env.ADMIN_OWNER_USER_ID?.trim();
  const client = createAdminClient();
  if (owner && owner === identity.userId) {
    await client.rpc("ops_bootstrap_owner", { p_owner_id: owner });
  }
  const { data } = await client.rpc("ops_get_admin_role", { p_user_id: identity.userId });
  const row = data as AdminRow | null;
  if (!row?.authorized || !isAdminRole(row.role)) return null;
  return { userId: identity.userId, role: row.role };
}
