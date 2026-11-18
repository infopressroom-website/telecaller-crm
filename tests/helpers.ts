import type { AuthUser } from "@/lib/auth/rbac";
import { permKey } from "@/lib/auth/rbac";
import { DEFAULT_ROLE_GRANTS, type RoleKey } from "@/lib/permissions";

/** Builds a user whose permissions come from the real default grants, as the seed does. */
export function makeUser(roleKey: RoleKey, id = `user-${roleKey}`): AuthUser {
  const perms = new Set<string>();
  for (const [resource, actions] of Object.entries(DEFAULT_ROLE_GRANTS[roleKey])) {
    for (const a of actions ?? []) perms.add(permKey(resource, a));
  }
  return { id, name: roleKey, email: `${roleKey}@crm.test`, roleKey, roleName: roleKey, teamId: null, sessionId: "s1", permissions: perms };
}
