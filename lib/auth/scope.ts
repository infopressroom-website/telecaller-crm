import type { Prisma } from "@prisma/client";
import type { RoleKey } from "@/lib/permissions";

// Data boundary: WHICH records a user may touch (permissions say WHAT they may do).
export type DataScope =
  | { kind: "ALL" }
  | { kind: "TEAMS"; userId: string; teamIds: string[]; includeUnassigned?: boolean }
  | { kind: "OWN"; userId: string }
  | { kind: "NONE" };

export type ScopeKind = DataScope["kind"];

export function scopeKindForRole(role: RoleKey): ScopeKind {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "ALL";
    case "MANAGER":
    case "TEAM_LEADER":
      return "TEAMS";
    case "TELECALLER":
      return "OWN";
    default:
      return "NONE"; // QA, HR and Viewer have no lead-level access
  }
}

/** Prisma filter for leads this scope may see. Always excludes archived leads. */
export function leadWhere(scope: DataScope): Prisma.LeadWhereInput {
  switch (scope.kind) {
    case "ALL":
      return { archivedAt: null };
    case "TEAMS":
      return {
        archivedAt: null,
        OR: [
          { teamId: { in: scope.teamIds } },
          { ownerId: scope.userId },
          // Managers also see brand-new leads that nobody owns yet, so they can distribute them.
          ...(scope.includeUnassigned ? [{ ownerId: null, teamId: null }] : []),
        ],
      };
    case "OWN":
      return { archivedAt: null, ownerId: scope.userId };
    case "NONE":
      return { id: { in: [] } }; // matches nothing
  }
}

// ---- Scope filters for other record types (same boundaries as leads) ----
const NOTHING = { id: { in: [] as string[] } };

export function callScopeWhere(scope: DataScope): Prisma.CallLogWhereInput {
  switch (scope.kind) {
    case "ALL":
      return {};
    case "OWN":
      return { agentId: scope.userId };
    case "TEAMS":
      return {
        OR: [
          { agentId: scope.userId },
          { agent: { teamId: { in: scope.teamIds } } },
          { lead: { teamId: { in: scope.teamIds } } },
        ],
      };
    case "NONE":
      return NOTHING;
  }
}

export function followUpScopeWhere(scope: DataScope): Prisma.FollowUpWhereInput {
  switch (scope.kind) {
    case "ALL":
      return {};
    case "OWN":
      return { ownerId: scope.userId };
    case "TEAMS":
      return {
        OR: [
          { ownerId: scope.userId },
          { owner: { teamId: { in: scope.teamIds } } },
          { lead: { teamId: { in: scope.teamIds } } },
        ],
      };
    case "NONE":
      return NOTHING;
  }
}

export function taskScopeWhere(scope: DataScope): Prisma.TaskWhereInput {
  switch (scope.kind) {
    case "ALL":
      return {};
    case "OWN":
      return { ownerId: scope.userId };
    case "TEAMS":
      return { OR: [{ ownerId: scope.userId }, { owner: { teamId: { in: scope.teamIds } } }] };
    case "NONE":
      return NOTHING;
  }
}

export function userScopeWhere(scope: DataScope): Prisma.UserWhereInput {
  switch (scope.kind) {
    case "ALL":
      return {};
    case "OWN":
      return { id: scope.userId };
    case "TEAMS":
      return { OR: [{ id: scope.userId }, { teamId: { in: scope.teamIds } }] };
    case "NONE":
      return NOTHING;
  }
}
