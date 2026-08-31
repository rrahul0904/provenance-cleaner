import type { NextConfig } from "next";
function origin(value: string | undefined) { try { return value ? new URL(value).origin : null; } catch { return null; } }
const supabaseOrigin = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const devEval = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${devEval} https://challenges.cloudflare.com`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", `connect-src 'self' https://challenges.cloudflare.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`, "frame-src https://challenges.cloudflare.com", "worker-src 'self' blob:", "font-src 'self' data:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
const securityHeaders = [{ key: "Content-Security-Policy", value: csp }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }, ...(process.env.VERCEL_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])];
const nextConfig: NextConfig = { poweredByHeader: false, async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; } };
export default nextConfig;
