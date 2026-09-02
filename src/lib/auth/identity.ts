import { createClient } from "@/lib/supabase/server";

export interface RequestIdentity { userId: string; isAnonymous: boolean; }

export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  const supabase = await createClient();
  // getUser performs an authoritative Auth-server lookup. This is intentional for
  // billable/sensitive API paths so a token for a deleted user does not remain
  // sufficient merely because its JWT signature and expiry are still valid.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, isAnonymous: Boolean(data.user.is_anonymous) };
}
