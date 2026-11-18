import "server-only";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/rbac";
import { leadWhere, scopeKindForRole, type DataScope } from "@/lib/auth/scope";

/**
 * ASSUMPTION (confirm with client): there is no Department model, so "Manager sees permitted
 * departments" is implemented as: teams they lead, teams led by their direct reports, and their own team.
 */
export async function resolveScope(user: AuthUser): Promise<DataScope> {
  const kind = scopeKindForRole(user.roleKey);
  if (kind === "ALL") return { kind: "ALL" };
  if (kind === "OWN") return { kind: "OWN", userId: user.id };
  if (kind === "NONE") return { kind: "NONE" };

  const teams = await db.team.findMany({
    where: {
      archivedAt: null,
      OR:
        user.roleKey === "MANAGER"
          ? [{ leaderId: user.id }, { leader: { reportingToId: user.id } }]
          : [{ leaderId: user.id }],
    },
    select: { id: true },
  });
  const teamIds = new Set(teams.map((t) => t.id));
  if (user.teamId) teamIds.add(user.teamId);
  return { kind: "TEAMS", userId: user.id, teamIds: [...teamIds], includeUnassigned: user.roleKey === "MANAGER" };
}

/**
 * Loads a lead only if it is inside the user's scope. Returns NOT_FOUND (not FORBIDDEN) for
 * out-of-scope ids so guessing IDs can't reveal which records exist.
 */
export async function getAccessibleLead(user: AuthUser, leadId: string) {
  const scope = await resolveScope(user);
  const lead = await db.lead.findFirst({ where: { AND: [{ id: leadId }, leadWhere(scope)] } });
  if (!lead) throw notFound("Lead");
  return lead;
}
