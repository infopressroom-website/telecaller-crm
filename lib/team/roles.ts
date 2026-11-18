import type { RoleKey } from "@/lib/permissions";

/** Which roles an actor may create or assign. Nobody can grant a role at or above their own, except the Super Admin. */
export function assignableRoles(actor: RoleKey): RoleKey[] {
  switch (actor) {
    case "SUPER_ADMIN": return ["SUPER_ADMIN", "ADMIN", "MANAGER", "TEAM_LEADER", "QA_MANAGER", "HR_OPERATIONS", "TELECALLER", "VIEWER"];
    case "ADMIN": return ["MANAGER", "TEAM_LEADER", "QA_MANAGER", "HR_OPERATIONS", "TELECALLER", "VIEWER"];
    case "HR_OPERATIONS": return ["TEAM_LEADER", "TELECALLER", "VIEWER"];
    default: return [];
  }
}
/** An actor may edit, deactivate or reset a user only if they could have assigned that user's role. */
export const canManageRole = (actor: RoleKey, target: RoleKey) => assignableRoles(actor).includes(target);
