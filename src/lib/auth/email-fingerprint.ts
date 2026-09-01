import { createHmac } from "node:crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailFingerprint(email: string, secret = process.env.PROMO_FINGERPRINT_SECRET) {
  if (!secret || secret.length < 32) throw new Error("PROMO_FINGERPRINT_SECRET must be configured with at least 32 characters.");
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) throw new Error("A valid email is required for the signup promotion.");
  return createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
}
