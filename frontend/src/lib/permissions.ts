import type { AuthUser } from "./auth";
import { isSuperAdmin } from "./auth";

/** True if a single granted permission string satisfies {@code required} (supports {@code module:*}). */
export function permissionMatchesGrant(userPerm: string, required: string): boolean {
  if (userPerm === required) return true;
  if (userPerm.endsWith(":*")) {
    const base = userPerm.slice(0, -2);
    return required === base || required.startsWith(`${base}:`);
  }
  return false;
}

export function userHasPermission(user: AuthUser | null, required: string): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return user.permissions.some((p) => permissionMatchesGrant(p, required));
}

export function userHasAnyPermission(user: AuthUser | null, required: string[]): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return required.some((r) => user.permissions.some((p) => permissionMatchesGrant(p, r)));
}

export function userHasRole(user: AuthUser | null, roles: readonly string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
