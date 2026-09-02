import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/public-config";

export type AuthCookie = { name: string; value: string; options: CookieOptions };

export async function createClient(onSetAll?: (cookiesToSet: AuthCookie[]) => void) {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* proxy.ts performs refreshes when Server Components cannot write cookies. */ }
        onSetAll?.(cookiesToSet);
      },
    },
  });
}

/**
 * Supabase auth can rotate or create session cookies while a Route Handler is
 * running. A handler's returned NextResponse is the response the browser sees,
 * so copy those mutations onto it explicitly rather than relying on the
 * request-scoped cookie store.
 */
export function applyAuthCookies(response: NextResponse, cookiesToSet: AuthCookie[]) {
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
