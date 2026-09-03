export const ADMIN_ROLES = ["owner", "admin", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const RANK: Record<AdminRole, number> = { viewer: 1, admin: 2, owner: 3 };
export function isAdminRole(value: unknown): value is AdminRole { return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole); }
export function allows(role: AdminRole, minimum: AdminRole) { return RANK[role] >= RANK[minimum]; }
export function canManageAdminUsers(role: AdminRole) { return role === "owner"; }
export function canMutateOperations(role: AdminRole) { return role === "owner" || role === "admin"; }
