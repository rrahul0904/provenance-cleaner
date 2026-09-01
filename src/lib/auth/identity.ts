import { createClient } from "@/lib/supabase/server";

export interface RequestIdentity { userId: string; isAnonymous: boolean; }

export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims || typeof claims.sub !== "string") return null;
  return { userId: claims.sub, isAnonymous: claims.is_anonymous === true || claims.is_anonymous === "true" };
}
