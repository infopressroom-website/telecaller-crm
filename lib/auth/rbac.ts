import { forbidden } from "@/lib/errors";
import type { Action, Resource, RoleKey } from "@/lib/permissions";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleKey: RoleKey;
  roleName: string;
  teamId: string | null;
  sessionId: string;
  mustChangePassword?: boolean;
  /** "resource:ACTION" strings loaded fresh from the database on every request */
  permissions: ReadonlySet<string>;
};

export const permKey = (resource: Resource | string, action: Action) => `${resource}:${action}`;

export const can = (user: Pick<AuthUser, "permissions">, resource: Resource | string, action: Action) =>
  user.permissions.has(permKey(resource, action));

/** Use in services and API handlers. Throws AppError FORBIDDEN. */
export function assertCan(user: Pick<AuthUser, "permissions">, resource: Resource | string, action: Action) {
  if (!can(user, resource, action)) throw forbidden();
}

export const homePathFor = (user: Pick<AuthUser, "roleKey">) =>
  user.roleKey === "TELECALLER" ? "/workspace" : "/dashboard";
