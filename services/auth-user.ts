import "server-only";
import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/rbac";
import { permKey } from "@/lib/auth/rbac";
import type { RoleKey } from "@/lib/permissions";

/** Builds an AuthUser for background work (cron, automation) from the database. Returns null for inactive users. */
export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const u = await db.user.findUnique({ where: { id: userId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  if (!u || u.status !== "ACTIVE" || u.archivedAt) return null;
  return {
    id: u.id, name: u.name, email: u.email, roleKey: u.role.key as RoleKey, roleName: u.role.name, teamId: u.teamId, sessionId: "system",
    permissions: new Set(u.role.permissions.map((rp) => permKey(rp.permission.resource, rp.permission.action))),
  };
}
