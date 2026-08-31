const DEFAULT_SUPABASE_URL = "https://cikxzxxreryycfjumwsd.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Jsa3NElnKfCPiXMes-CrXg_hthFy4r1";
const PREVIEW_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

export function getPublicSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getTurnstileSiteKey() {
  const configured = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (configured) return configured;
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? PREVIEW_TURNSTILE_SITE_KEY : undefined;
}
