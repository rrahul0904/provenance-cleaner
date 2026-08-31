import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let adminClient: SupabaseClient<Database> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase elevated server configuration is missing.");
  adminClient = createClient<Database>(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return adminClient;
}
