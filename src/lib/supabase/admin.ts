import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/public-config";
import type { Database } from "./database.types";

let adminClient: SupabaseClient<Database> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;
  const { url } = getPublicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Supabase elevated server configuration is missing.");
  adminClient = createClient<Database>(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return adminClient;
}
