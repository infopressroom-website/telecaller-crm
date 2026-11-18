// Reference data shared by the development seed and the production bootstrap, so they can never drift apart.
import type { PrismaClient } from "@prisma/client";
import { ACTIONS, DEFAULT_ROLE_GRANTS, RESOURCES, ROLE_KEYS, type RoleKey } from "../lib/permissions";

export const ROLE_NAMES: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin", ADMIN: "Admin", MANAGER: "Manager", TEAM_LEADER: "Team Leader",
  QA_MANAGER: "QA Manager", HR_OPERATIONS: "HR / Operations", TELECALLER: "Telecaller", VIEWER: "Viewer",
};

export const DISPOSITIONS = [
  { key: "CONNECTED", label: "Connected", isConnected: true },
  { key: "NOT_ANSWERED", label: "Not Answered" },
  { key: "BUSY", label: "Busy" },
  { key: "SWITCHED_OFF", label: "Switched Off" },
  { key: "INTERESTED", label: "Interested", isConnected: true },
  { key: "NOT_INTERESTED", label: "Not Interested", isConnected: true, isFinal: true },
  { key: "CALLBACK_REQUESTED", label: "Callback Requested", isConnected: true, requiresFollowUp: true },
  { key: "WRONG_NUMBER", label: "Wrong Number", isFinal: true },
  { key: "CONVERTED", label: "Converted", isConnected: true, isFinal: true },
  { key: "DND", label: "Do Not Disturb", isFinal: true },
];

export const STARTER_RULES = [
  { name: "Remind owner when a follow-up is due", trigger: "FOLLOWUP_DUE", conditions: { campaignId: null, minLeadPriority: null, threshold: null }, actions: [{ type: "NOTIFY_OWNER" }] },
  { name: "Alert manager about overdue follow-ups", trigger: "FOLLOWUP_OVERDUE", conditions: { campaignId: null, minLeadPriority: null, threshold: 60 }, actions: [{ type: "NOTIFY_MANAGER" }] },
  { name: "Alert manager about unworked leads", trigger: "LEAD_UNWORKED", conditions: { campaignId: null, minLeadPriority: null, threshold: 4 }, actions: [{ type: "NOTIFY_MANAGER" }] },
  { name: "Daily summary to managers", trigger: "END_OF_DAY", conditions: { campaignId: null, minLeadPriority: null, threshold: 19 }, actions: [{ type: "DAILY_REPORT", role: "MANAGER" }] },
];

/** Creates permissions, roles and their default grants (grants are defined in code and re-applied on every run). */
export async function syncPermissionsAndRoles(prisma: PrismaClient): Promise<Record<RoleKey, string>> {
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      await prisma.permission.upsert({ where: { resource_action: { resource, action } }, update: {}, create: { resource, action } });
    }
  }
  const roleIds = {} as Record<RoleKey, string>;
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.upsert({ where: { key }, update: { name: ROLE_NAMES[key] }, create: { key, name: ROLE_NAMES[key] } });
    roleIds[key] = role.id;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const [resource, actions] of Object.entries(DEFAULT_ROLE_GRANTS[key])) {
      for (const action of actions ?? []) {
        const perm = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource, action } } });
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
      }
    }
  }
  return roleIds;
}

/** The built-in call outcomes. Existing rows keep any label/flag changes an administrator made. */
export async function syncDispositions(prisma: PrismaClient) {
  for (const [i, d] of DISPOSITIONS.entries()) {
    await prisma.callDisposition.upsert({ where: { key: d.key }, update: { isSystem: true }, create: { ...d, sortOrder: i, isSystem: true } });
  }
}

/** Starter automation rules, all switched OFF. Never overwrites rules that already exist. */
export async function ensureStarterRules(prisma: PrismaClient) {
  for (const r of STARTER_RULES) {
    if (!(await prisma.automationRule.findFirst({ where: { name: r.name } }))) await prisma.automationRule.create({ data: { ...r, isEnabled: false } });
  }
}
