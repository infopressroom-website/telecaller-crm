import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { addDays, dayKeyIST, IST_OFFSET_MS, startOfDayIST } from "@/lib/date-range";
import {
  ACTION_LABELS, TRIGGER_INFO, buildMessage, prioritiesAtLeast, readActions, readConditions, thresholdFor, type ActionType, type RuleConfig, type Trigger,
} from "@/lib/automation/rules";
import { unworkedClause } from "@/lib/distribution/unworked";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "./audit-service";
import { loadAuthUser } from "./auth-user";
import { applyDistribution } from "./distribution-service";
import { markMissedFollowUps } from "./followup-service";
import { notify } from "./notification-service";

type Rule = { id: string; name: string; trigger: Trigger; isEnabled: boolean; createdById: string | null; conditions: ReturnType<typeof readConditions>; actions: ReturnType<typeof readActions> };
type Match = { key: string; entityType: string; entityId: string; subjectUserId: string | null; leadId?: string; leadName?: string; leadCode?: string; agentName?: string; due?: Date; count?: number; subjectName?: string };

const fmtDue = (d?: Date) => d?.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const istHour = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).getUTCHours();

function toRule(r: { id: string; name: string; trigger: string; isEnabled: boolean; createdById: string | null; conditions: unknown; actions: unknown }): Rule {
  return { id: r.id, name: r.name, trigger: r.trigger as Trigger, isEnabled: r.isEnabled, createdById: r.createdById, conditions: readConditions(r.conditions), actions: readActions(r.actions) };
}

// ───────────── finding what a rule applies to right now ─────────────

async function findMatches(rule: Rule, now: Date): Promise<Match[]> {
  const c = rule.conditions;
  const leadCond: Prisma.LeadWhereInput = { archivedAt: null, ...(c.campaignId ? { campaignId: c.campaignId } : {}), ...(c.minLeadPriority ? { priority: { in: prioritiesAtLeast(c.minLeadPriority) } } : {}) };
  const t = thresholdFor(rule.trigger, c.threshold);
  const HOUR = 3_600_000;

  switch (rule.trigger) {
    case "FOLLOWUP_DUE":
    case "FOLLOWUP_OVERDUE": {
      const overdue = rule.trigger === "FOLLOWUP_OVERDUE";
      const newest = overdue ? new Date(now.getTime() - t * 60_000) : now;
      const oldest = new Date(now.getTime() - (overdue ? 7 * 24 : 24) * HOUR);
      const rows = await db.followUp.findMany({
        where: { status: "PENDING", dueAt: { lte: newest, gte: oldest }, lead: leadCond }, take: 200, orderBy: { dueAt: "asc" },
        select: { id: true, dueAt: true, ownerId: true, owner: { select: { name: true } }, lead: { select: { id: true, name: true, leadCode: true } } },
      });
      return rows.map((r) => ({ key: `fu:${r.id}:${overdue ? "overdue" : "due"}`, entityType: "FollowUp", entityId: r.id, subjectUserId: r.ownerId, leadId: r.lead.id, leadName: r.lead.name, leadCode: r.lead.leadCode, agentName: r.owner.name, due: r.dueAt }));
    }
    case "LEAD_UNWORKED": {
      const rows = await db.lead.findMany({
        where: { AND: [unworkedClause(new Date(now.getTime() - t * HOUR)), leadCond] }, take: 200,
        select: { id: true, name: true, leadCode: true, ownerId: true, owner: { select: { name: true } }, assignments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
      });
      return rows.map((l) => ({ key: `lead:${l.id}:unworked:${l.assignments[0]?.id ?? "none"}`, entityType: "Lead", entityId: l.id, subjectUserId: l.ownerId, leadId: l.id, leadName: l.name, leadCode: l.leadCode, agentName: l.owner?.name }));
    }
    case "LEAD_CONVERTED": {
      const rows = await db.leadActivity.findMany({
        where: { type: "STATUS_CHANGED", createdAt: { gte: new Date(now.getTime() - 24 * HOUR) }, data: { path: ["to"], equals: "CONVERTED" }, lead: leadCond }, take: 200,
        select: { id: true, lead: { select: { id: true, name: true, leadCode: true, ownerId: true, owner: { select: { name: true } } } }, actor: { select: { name: true } } },
      });
      return rows.map((a) => ({ key: `act:${a.id}`, entityType: "LeadActivity", entityId: a.id, subjectUserId: a.lead.ownerId, leadId: a.lead.id, leadName: a.lead.name, leadCode: a.lead.leadCode, agentName: a.lead.owner?.name ?? a.actor?.name }));
    }
    case "NEW_LEADS_WAITING": {
      const count = await db.lead.count({ where: { ...leadCond, ownerId: null, status: "NEW" } });
      return count >= Math.max(1, t) ? [{ key: `waiting:${Math.floor(now.getTime() / 300_000)}`, entityType: "Lead", entityId: "batch", subjectUserId: null, count }] : [];
    }
    case "EMPLOYEE_ABSENT": {
      const rows = await db.attendance.findMany({
        where: { date: new Date(`${dayKeyIST(now)}T00:00:00Z`), status: { in: ["ABSENT", "ON_LEAVE"] }, user: { status: "ACTIVE", archivedAt: null } }, take: 200,
        select: { id: true, userId: true, user: { select: { name: true } } },
      });
      return rows.map((a) => ({ key: `abs:${a.id}`, entityType: "Attendance", entityId: a.id, subjectUserId: a.userId, subjectName: a.user.name, agentName: a.user.name }));
    }
    case "END_OF_DAY":
      return istHour(now) >= (c.threshold ?? TRIGGER_INFO.END_OF_DAY.threshold!.default) ? [{ key: `eod:${dayKeyIST(now)}`, entityType: "Day", entityId: dayKeyIST(now), subjectUserId: null }] : [];
  }
}

// ───────────── recipients ─────────────

async function managerOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { reportingToId: true, team: { select: { leaderId: true } } } });
  const m = u?.reportingToId ?? u?.team?.leaderId ?? null;
  return m && m !== userId ? m : null;
}
async function usersWithRole(role: string) {
  return db.user.findMany({ where: { status: "ACTIVE", archivedAt: null, role: { key: role } }, select: { id: true }, take: 50 });
}

async function dailySummary(now: Date) {
  const start = startOfDayIST(now), end = addDays(start, 1);
  const day = { createdAt: { gte: start, lt: end } };
  const [attempts, connected, converted, newLeads, unassigned, followDone, overdue] = await Promise.all([
    db.callLog.count({ where: { ...day, status: { notIn: ["INITIATED", "RINGING", "IN_PROGRESS"] } } }),
    db.callLog.count({ where: { ...day, disposition: { isConnected: true } } }),
    db.callLog.findMany({ where: { ...day, disposition: { key: "CONVERTED" } }, distinct: ["leadId"], select: { leadId: true } }),
    db.lead.count({ where: { ...day, archivedAt: null } }),
    db.lead.count({ where: { archivedAt: null, ownerId: null, status: "NEW" } }),
    db.followUp.count({ where: { status: "COMPLETED", completedAt: { gte: start, lt: end } } }),
    db.followUp.count({ where: { status: "PENDING", dueAt: { lt: start } } }),
  ]);
  return `Calls ${attempts} (connected ${connected}) · Conversions ${converted.length} · New leads ${newLeads} · Unassigned ${unassigned} · Follow-ups done ${followDone} · Overdue ${overdue}`;
}

// ───────────── running actions ─────────────

type ActionResult = { action: ActionType; detail: string };

async function runAction(rule: Rule, action: Rule["actions"][number], m: Match, now: Date): Promise<ActionResult> {
  const vars = { leadName: m.leadName, leadCode: m.leadCode, agentName: m.agentName, due: fmtDue(m.due), count: m.count, subject: m.subjectName, hours: thresholdFor(rule.trigger, rule.conditions.threshold) };
  const link = m.leadId ? `/leads/${m.leadId}` : "/follow-ups";
  const send = async (userId: string, redact: boolean, prefix = "") => {
    const msg = buildMessage(rule.trigger, vars, redact);
    return notify({ userId, title: `${prefix}${msg.title}`, body: msg.body, link: m.leadId ? (userId === m.subjectUserId ? `/workspace/lead/${m.leadId}` : link) : link, dedupeKey: `auto:${rule.id}:${m.key}:${action.type}:${userId}` });
  };

  switch (action.type) {
    case "NOTIFY_OWNER": {
      if (!m.subjectUserId) return { action: action.type, detail: "No owner to notify" };
      return { action: action.type, detail: (await send(m.subjectUserId, false)) ? "Notified owner" : "Already notified" };
    }
    case "NOTIFY_MANAGER": {
      let to = await managerOf(m.subjectUserId);
      let prefix = "";
      if (!to && rule.createdById) { to = rule.createdById; prefix = "[No manager set] "; } // never lose an alert silently
      if (!to) return { action: action.type, detail: "No manager found" };
      return { action: action.type, detail: (await send(to, false, prefix)) ? "Notified manager" : "Already notified" };
    }
    case "NOTIFY_ROLE": {
      const users = await usersWithRole(action.role ?? "MANAGER");
      let sent = 0;
      for (const u of users) if (await send(u.id, true)) sent++; // customer name is left out when a whole role is notified
      return { action: action.type, detail: `Notified ${sent} of ${users.length} ${action.role ?? "MANAGER"} users` };
    }
    case "FLAG_FOR_REVIEW": {
      const to = (await managerOf(m.subjectUserId)) ?? rule.createdById;
      if (!to) return { action: action.type, detail: "No one to assign the review task to" };
      const title = rule.trigger === "EMPLOYEE_ABSENT" ? `Review pending leads of ${m.subjectName ?? "absent employee"}` : `Review unworked lead ${m.leadCode ?? ""}`.trim();
      await db.task.create({ data: { title, description: `Created by automation rule “${rule.name}”.`, ownerId: to, priority: "HIGH", dueAt: new Date(now.getTime() + 86_400_000), leadId: m.leadId ?? null } });
      return { action: action.type, detail: "Review task created" };
    }
    case "ASSIGN_NEW_LEADS": {
      const actor = rule.createdById ? await loadAuthUser(rule.createdById) : null;
      if (!actor) throw new AppError("FORBIDDEN", "The rule's creator is no longer active, so it can't distribute leads.");
      const r = await applyDistribution(actor, randomUUID(), "UNASSIGNED");
      return { action: action.type, detail: `Assigned ${r.assigned}, left ${r.unallocated}` };
    }
    case "DAILY_REPORT": {
      const body = await dailySummary(now);
      const users = await usersWithRole(action.role ?? "MANAGER");
      let sent = 0;
      for (const u of users) if (await notify({ userId: u.id, title: `Daily summary ${dayKeyIST(now)}`, body, link: "/reports", dedupeKey: `auto:${rule.id}:${m.key}:${u.id}` })) sent++;
      return { action: action.type, detail: `Sent to ${sent} of ${users.length}` };
    }
  }
}

async function claim(rule: Rule, m: Match): Promise<boolean> {
  const dedupeKey = `${rule.id}:${m.key}`;
  try {
    await db.automationLog.create({ data: { ruleId: rule.id, dedupeKey, trigger: rule.trigger, entityType: m.entityType, entityId: m.entityId, status: "CLAIMED" } });
    return true;
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    // Seen before: only a FAILED attempt (max 3) may be retried.
    const r = await db.automationLog.updateMany({ where: { dedupeKey, status: "FAILED", attempts: { lt: 3 } }, data: { status: "CLAIMED", attempts: { increment: 1 }, error: null } });
    return r.count === 1;
  }
}

export type RuleReport = { ruleId: string; name: string; matches: number; processed: number; skipped: number; failed: number; sample: string[] };

export async function runAutomation(opts: { dryRun: boolean; ruleId?: string; now?: Date } = { dryRun: false }): Promise<RuleReport[]> {
  const now = opts.now ?? new Date();
  const rows = await db.automationRule.findMany({ where: { ...(opts.ruleId ? { id: opts.ruleId } : { isEnabled: true }) } });
  const reports: RuleReport[] = [];

  for (const row of rows) {
    const rule = toRule(row);
    const rep: RuleReport = { ruleId: rule.id, name: rule.name, matches: 0, processed: 0, skipped: 0, failed: 0, sample: [] };
    reports.push(rep);
    let matches: Match[];
    try { matches = await findMatches(rule, now); } catch (e) { console.error("Automation lookup failed", rule.id, e); rep.failed++; continue; }
    rep.matches = matches.length;
    rep.sample = matches.slice(0, 5).map((m) => buildMessage(rule.trigger, { leadName: m.leadName, leadCode: m.leadCode, agentName: m.agentName, due: fmtDue(m.due), count: m.count, subject: m.subjectName, hours: thresholdFor(rule.trigger, rule.conditions.threshold) }).title);
    if (opts.dryRun) continue;

    for (const m of matches) {
      if (!(await claim(rule, m))) { rep.skipped++; continue; }
      try {
        const results: ActionResult[] = [];
        for (const a of rule.actions) results.push(await runAction(rule, a, m, now));
        await db.automationLog.update({ where: { dedupeKey: `${rule.id}:${m.key}` }, data: { status: "DONE", result: results as unknown as Prisma.InputJsonValue } });
        rep.processed++;
      } catch (e) {
        rep.failed++;
        await db.automationLog.update({ where: { dedupeKey: `${rule.id}:${m.key}` }, data: { status: "FAILED", error: (e instanceof Error ? e.message : "error").slice(0, 300) } });
      }
    }
  }
  return reports;
}

/** One scheduler tick: rules, then housekeeping. Called by /api/cron/automation (every minute) and the admin "Run now" button. */
export async function runTick() {
  const started = new Date();
  const rules = await runAutomation({ dryRun: false, now: started });
  const missed = await markMissedFollowUps(24, started);
  await db.setting.upsert({ where: { key: "automation_last_run" }, create: { key: "automation_last_run", value: { at: started.toISOString(), rules: rules.length, missed } }, update: { value: { at: started.toISOString(), rules: rules.length, missed } } });
  return { rules, missedFollowUps: missed };
}

// ───────────── admin: rules CRUD, test, logs ─────────────

export async function listRules(user: AuthUser) {
  assertCan(user, "automation", "VIEW");
  const [rows, counts] = await Promise.all([
    db.automationRule.findMany({ orderBy: { createdAt: "asc" } }),
    db.automationLog.groupBy({ by: ["ruleId", "status"], where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, _count: { _all: true } }),
  ]);
  return rows.map((r) => {
    const rule = toRule(r);
    const c = (s: string) => counts.find((x) => x.ruleId === r.id && x.status === s)?._count._all ?? 0;
    return { ...rule, done: c("DONE"), failed: c("FAILED") };
  });
}

export async function getRule(user: AuthUser, id: string) {
  assertCan(user, "automation", "VIEW");
  const r = await db.automationRule.findUnique({ where: { id } });
  if (!r) throw notFound("Rule");
  return toRule(r);
}

export async function listLogs(user: AuthUser) {
  assertCan(user, "automation", "VIEW");
  const logs = await db.automationLog.findMany({ orderBy: { updatedAt: "desc" }, take: 30 });
  const rules = await db.automationRule.findMany({ where: { id: { in: logs.map((l) => l.ruleId) } }, select: { id: true, name: true } });
  const nm = new Map(rules.map((r) => [r.id, r.name]));
  return logs.map((l) => ({ ...l, ruleName: nm.get(l.ruleId) ?? "(deleted rule)" }));
}

export async function getSchedulerStatus(user: AuthUser) {
  assertCan(user, "automation", "VIEW");
  const row = await db.setting.findUnique({ where: { key: "automation_last_run" } });
  const v = (row?.value ?? {}) as { at?: string };
  return { lastRunAt: v.at ? new Date(v.at) : null, cronConfigured: (process.env.CRON_SECRET ?? "").length >= 24 };
}

export async function saveRule(user: AuthUser, id: string | null, input: RuleConfig) {
  assertCan(user, "automation", "MANAGE");
  const data = {
    name: input.name, trigger: input.trigger, isEnabled: input.isEnabled,
    conditions: { campaignId: input.campaignId, minLeadPriority: input.minLeadPriority, threshold: input.threshold } as Prisma.InputJsonValue,
    actions: input.actions as unknown as Prisma.InputJsonValue,
  };
  const saved = id ? await db.automationRule.update({ where: { id }, data }) : await db.automationRule.create({ data: { ...data, createdById: user.id } });
  await audit({ actorId: user.id, action: id ? "automation.update" : "automation.create", entityType: "AutomationRule", entityId: saved.id, after: { name: input.name, trigger: input.trigger, enabled: input.isEnabled, actions: input.actions.map((a) => a.type) } });
  return saved.id;
}

export async function setRuleEnabled(user: AuthUser, id: string, enabled: boolean) {
  assertCan(user, "automation", "MANAGE");
  await db.automationRule.update({ where: { id }, data: { isEnabled: enabled } });
  await audit({ actorId: user.id, action: "automation.toggle", entityType: "AutomationRule", entityId: id, after: { enabled } });
}

export async function deleteRule(user: AuthUser, id: string) {
  assertCan(user, "automation", "MANAGE");
  await db.automationRule.delete({ where: { id } });
  await audit({ actorId: user.id, action: "automation.delete", entityType: "AutomationRule", entityId: id });
}

/** Dry run: shows what the rule would act on right now. Nothing is sent, assigned or logged. */
export async function testRule(user: AuthUser, id: string) {
  assertCan(user, "automation", "MANAGE");
  const [r] = await runAutomation({ dryRun: true, ruleId: id });
  if (!r) throw notFound("Rule");
  return r;
}

export async function runNow(user: AuthUser) {
  assertCan(user, "automation", "MANAGE");
  const t = await runTick();
  await audit({ actorId: user.id, action: "automation.run_now", entityType: "AutomationRule", after: { rules: t.rules.length, missed: t.missedFollowUps } });
  return t;
}

export const describeActions = (actions: Rule["actions"]) => actions.map((a) => (a.type === "NOTIFY_ROLE" ? `Notify ${a.role}` : ACTION_LABELS[a.type])).join(" → ");
