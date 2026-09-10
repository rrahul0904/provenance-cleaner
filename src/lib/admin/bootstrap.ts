import type { RequestIdentity } from "@/lib/auth/identity";
import { isConfiguredAdminOwnerEmail } from "@/lib/server/env";

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

export function shouldBootstrapOwner(
  identity: RequestIdentity,
  ownerUserId: string | undefined,
  ownerEmail: string | undefined,
) {
  if (identity.isAnonymous) return false;
  const configuredId = ownerUserId?.trim();
  if (configuredId) return configuredId === identity.userId;
  if (!identity.emailVerified || !identity.email || !isConfiguredAdminOwnerEmail(ownerEmail)) return false;
  return normalizedEmail(identity.email) === normalizedEmail(ownerEmail);
}
