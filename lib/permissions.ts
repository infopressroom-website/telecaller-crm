// Single source of truth for role keys and permission resources.
// Enforcement (server-side) is implemented in Phase 03; seed uses these definitions now.

export const ROLE_KEYS = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "TEAM_LEADER",
  "QA_MANAGER",
  "HR_OPERATIONS",
  "TELECALLER",
  "VIEWER",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "EXPORT", "APPROVE", "MANAGE"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "dashboard", "lead", "distribution", "user", "team", "call", "followup", "task",
  "attendance", "performance", "incentive", "qa", "report", "automation", "settings", "audit",
  "analytics",
] as const;
export type Resource = (typeof RESOURCES)[number];

const all = (): Record<string, Action[]> =>
  Object.fromEntries(RESOURCES.map((r) => [r, [...ACTIONS]]));

// Default grants per role. Data *scope* (own / team / department) is enforced in Phase 03.
export const DEFAULT_ROLE_GRANTS: Record<RoleKey, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: all(),
  ADMIN: { ...all(), audit: ["VIEW"] },
  MANAGER: {
    dashboard: ["VIEW"], lead: ["VIEW", "CREATE", "EDIT", "ASSIGN", "EXPORT", "MANAGE"],
    distribution: ["VIEW", "EDIT", "ASSIGN", "APPROVE"], user: ["VIEW"], team: ["VIEW", "EDIT"],
    call: ["VIEW"], followup: ["VIEW", "EDIT"], task: ["VIEW", "CREATE", "EDIT"],
    attendance: ["VIEW"], performance: ["VIEW", "EDIT"], incentive: ["VIEW", "APPROVE"],
    qa: ["VIEW"], report: ["VIEW", "EXPORT"], analytics: ["VIEW", "EXPORT"],
  },
  TEAM_LEADER: {
    dashboard: ["VIEW"], lead: ["VIEW", "EDIT", "ASSIGN"], distribution: ["VIEW"],
    team: ["VIEW"], call: ["VIEW"], followup: ["VIEW", "EDIT"], task: ["VIEW", "CREATE", "EDIT"],
    attendance: ["VIEW"], performance: ["VIEW"], report: ["VIEW"], analytics: ["VIEW"],
  },
  QA_MANAGER: {
    dashboard: ["VIEW"], call: ["VIEW"], qa: ["VIEW", "CREATE", "EDIT", "MANAGE"],
    performance: ["VIEW"], report: ["VIEW", "EXPORT"], analytics: ["VIEW"],
  },
  HR_OPERATIONS: {
    dashboard: ["VIEW"], user: ["VIEW", "CREATE", "EDIT"], team: ["VIEW"], attendance: ["VIEW", "CREATE", "EDIT", "MANAGE"],
    incentive: ["VIEW", "CREATE"], performance: ["VIEW"], report: ["VIEW", "EXPORT"],
  },
  TELECALLER: {
    lead: ["VIEW", "EDIT"], call: ["VIEW", "CREATE"], followup: ["VIEW", "CREATE", "EDIT"],
    task: ["VIEW", "EDIT"], attendance: ["VIEW", "CREATE"], performance: ["VIEW"], incentive: ["VIEW"],
  },
  VIEWER: { dashboard: ["VIEW"], report: ["VIEW"] },
};
