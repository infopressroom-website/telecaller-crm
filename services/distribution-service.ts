import "server-only";
import { Prisma, type LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { leadWhere, userScopeWhere, type DataScope } from "@/lib/auth/scope";
import { dayKeyIST, startOfDayIST } from "@/lib/date-range";
import {
  planDistribution, type AgentState, type DistributionMethod, type LeadInput, type Plan, type PriorityKey, type RuleDef,
} from "@/lib/distribution/engine";
import { unworkedClause } from "@/lib/distribution/unworked";
import { AppError, notFound } from "@/lib/errors";
import type { RuleInput } from "@/validations/distribution";
import { audit } from "./audit-service";
import { getAccessibleLead, resolveScope } from "./scope-service";
import { getDistributionSettings } from "./settings-service";

export type Mode = "UNASSIGNED" | "ABSENT_OWNERS";
const MAX_PER_RUN = 2000;
const LOCK_KEY = 7_160_601; // one global lock: runs apply one at a time
const TERMINAL: LeadStatus[] = ["CONVERTED", "LOST", "INVALID", "DND"];
type Tx = Prisma.TransactionClient;

// ───────────── loading everything the engine needs ─────────────

async function absentToday(c: Tx, now: Date) {
  // Until attendance is recorded (Phase 10) nobody is "absent", so this simply finds nothing.
  const rows = await c.attendance.findMany({
    where: { date: new Date(`${dayKeyIST(now)}T00:00:00Z`), status: { in: ["ABSENT", "ON_LEAVE", "HOLIDAY"] } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

async function loadInputs(c: Tx, scope: DataScope, mode: Mode, now: Date) {
  const absent = await absentToday(c, now);
  const users = await c.user.findMany({
    where: { AND: [userScopeWhere(scope), { role: { key: "TELECALLER" }, status: "ACTIVE", archivedAt: null }] },
    select: { id: true, name: true, teamId: true, maxActiveLeads: true, dailyLeadLimit: true, assignmentPaused: true, serviceCities: true, serviceStates: true },
  });
  // Inactive, paused and absent employees never receive leads.
  const eligible = users.filter((u) => !u.assignmentPaused && !absent.has(u.id));
  const ids = eligible.map((u) => u.id);
  const [active, today] = await Promise.all([
    c.lead.groupBy({ by: ["ownerId"], where: { ownerId: { in: ids }, archivedAt: null, status: { notIn: TERMINAL } }, _count: { _all: true } }),
    c.leadAssignment.groupBy({ by: ["toUserId"], where: { toUserId: { in: ids }, createdAt: { gte: startOfDayIST(now) } }, _count: { _all: true } }),
  ]);
  const activeOf = new Map(active.map((r) => [r.ownerId, r._count._all]));
  const todayOf = new Map(today.map((r) => [r.toUserId, r._count._all]));
  const agents: AgentState[] = eligible.map((u) => ({
    id: u.id, name: u.name, teamId: u.teamId, cities: u.serviceCities, states: u.serviceStates,
    activeLeads: activeOf.get(u.id) ?? 0, assignedToday: todayOf.get(u.id) ?? 0, maxActive: u.maxActiveLeads, dailyLimit: u.dailyLeadLimit,
  }));

  const ruleRows = await c.distributionRule.findMany({ where: { isActive: true, archivedAt: null }, include: { agents: { select: { userId: true } } } });
  const rules: RuleDef[] = ruleRows.map((r) => ({
    id: r.id, name: r.name, method: r.method as DistributionMethod, priority: r.priority, campaignId: r.campaignId, sourceId: r.sourceId,
    minLeadPriority: r.minLeadPriority as PriorityKey | null, matchCities: r.matchCities, matchStates: r.matchStates, teamId: r.teamId,
    agentIds: r.agents.map((a) => a.userId), maxActiveLeads: r.maxActiveLeads, dailyLimit: r.dailyLimit, fallbackToAny: r.fallbackToAny, cursorUserId: r.cursorUserId,
  }));

  const leadWhereMode: Prisma.LeadWhereInput =
    mode === "UNASSIGNED"
      ? { ownerId: null, status: "NEW" }
      : { ownerId: { in: [...absent] }, status: "ASSIGNED", calls: { none: {} } };
  const leadRows =
    mode === "ABSENT_OWNERS" && absent.size === 0
      ? []
      : await c.lead.findMany({
          where: { AND: [leadWhere(scope), leadWhereMode] },
          orderBy: { createdAt: "asc" },
          take: MAX_PER_RUN + 1,
          select: { id: true, leadCode: true, name: true, ownerId: true, campaignId: true, sourceId: true, priority: true, city: true, state: true, createdAt: true },
        });
  const capped = leadRows.length > MAX_PER_RUN;
  const leads = leadRows.slice(0, MAX_PER_RUN);
  const leadInputs: LeadInput[] = leads.map((l) => ({ id: l.id, campaignId: l.campaignId, sourceId: l.sourceId, priority: l.priority as PriorityKey, city: l.city, state: l.state, createdAt: l.createdAt }));
  return { agents, rules, leads, leadInputs, capped, absentCount: absent.size };
}

// ───────────── preview ─────────────

export type DistributionPreview = {
  mode: Mode; totalLeads: number; capped: boolean; assigned: number; unallocated: number; agentCount: number; ruleCount: number;
  byAgent: { id: string; name: string; assigned: number; before: number; after: number }[];
  byRule: { id: string; name: string; count: number }[];
  reasons: { reason: string; count: number }[];
  sample: { leadCode: string; leadName: string; agentName: string; ruleName: string }[];
};

export async function previewDistribution(user: AuthUser, mode: Mode): Promise<DistributionPreview> {
  assertCan(user, "distribution", "ASSIGN");
  if (mode === "ABSENT_OWNERS") assertCan(user, "distribution", "APPROVE");
  const scope = await resolveScope(user);
  const inputs = await loadInputs(db, scope, mode, new Date());
  const plan = planDistribution(inputs.leadInputs, inputs.rules, inputs.agents);
  return summarisePlan(mode, plan, inputs);
}

function summarisePlan(mode: Mode, plan: Plan, inputs: Awaited<ReturnType<typeof loadInputs>>): DistributionPreview {
  const agentName = new Map(inputs.agents.map((a) => [a.id, a.name]));
  const ruleName = new Map(inputs.rules.map((r) => [r.id, r.name]));
  const lead = new Map(inputs.leads.map((l) => [l.id, l]));
  const count = <K,>(xs: K[]) => { const m = new Map<K, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
  const perAgent = count(plan.assignments.map((a) => a.agentId));
  const perRule = count(plan.assignments.map((a) => a.ruleId));
  const reasons = count(plan.unallocated.map((u) => u.reason));
  return {
    mode, totalLeads: inputs.leads.length, capped: inputs.capped, assigned: plan.assignments.length, unallocated: plan.unallocated.length,
    agentCount: inputs.agents.length, ruleCount: inputs.rules.length,
    byAgent: [...perAgent].map(([id, n]) => ({ id, name: agentName.get(id) ?? id, assigned: n, before: plan.agentLoad[id]?.before ?? 0, after: plan.agentLoad[id]?.after ?? 0 })).sort((a, b) => b.assigned - a.assigned),
    byRule: [...perRule].map(([id, n]) => ({ id, name: ruleName.get(id) ?? id, count: n })),
    reasons: [...reasons].map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count),
    sample: plan.assignments.slice(0, 15).map((a) => ({ leadCode: lead.get(a.leadId)?.leadCode ?? "", leadName: lead.get(a.leadId)?.name ?? "", agentName: agentName.get(a.agentId) ?? "", ruleName: ruleName.get(a.ruleId) ?? "" })),
  };
}

// ───────────── apply (locked, idempotent, compare-and-swap) ─────────────

export type RunSummary = {
  mode: Mode; assigned: number; unallocated: number; raced: number;
  byAgent: { name: string; count: number }[]; reasons: { reason: string; count: number }[]; alreadyApplied?: boolean;
};

/**
 * Safety design:
 *  1. An advisory lock makes runs apply one at a time, and the plan is recomputed AFTER taking it, so limits and
 *     workloads are never stale.
 *  2. `runId` is a primary key: submitting the same Apply twice returns the first result instead of assigning twice.
 *  3. Every lead is moved with a compare-and-swap (`WHERE ownerId IS NULL` / `WHERE ownerId = previous owner`),
 *     so a lead someone else just assigned is skipped, never overwritten.
 *  4. Assignment rows carry a unique idempotency key (`runId:leadId`).
 */
export async function applyDistribution(user: AuthUser, runId: string, mode: Mode): Promise<RunSummary> {
  assertCan(user, "distribution", "ASSIGN");
  if (mode === "ABSENT_OWNERS") assertCan(user, "distribution", "APPROVE");

  const summary = await db.$transaction(async (tx): Promise<RunSummary> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
    const existing = await tx.distributionRun.findUnique({ where: { id: runId } });
    if (existing) return { ...(existing.summary as RunSummary), alreadyApplied: true };

    const scope = await resolveScope(user);
    const inputs = await loadInputs(tx, scope, mode, new Date());
    const plan = planDistribution(inputs.leadInputs, inputs.rules, inputs.agents);
    const leadById = new Map(inputs.leads.map((l) => [l.id, l]));
    const agentById = new Map(inputs.agents.map((a) => [a.id, a]));

    const done: { leadId: string; from: string | null; to: string; ruleId: string; method: DistributionMethod }[] = [];
    let raced = 0;
    for (const a of plan.assignments) {
      const lead = leadById.get(a.leadId)!;
      const res = await tx.lead.updateMany({
        where: mode === "UNASSIGNED"
          ? { id: a.leadId, ownerId: null, status: "NEW", archivedAt: null }
          : { id: a.leadId, ownerId: lead.ownerId, status: "ASSIGNED", archivedAt: null },
        data: { ownerId: a.agentId, teamId: agentById.get(a.agentId)?.teamId ?? null, status: "ASSIGNED" },
      });
      if (res.count === 1) done.push({ leadId: a.leadId, from: lead.ownerId, to: a.agentId, ruleId: a.ruleId, method: a.method });
      else raced++;
    }
    if (done.length) {
      await tx.leadAssignment.createMany({
        data: done.map((d) => ({
          leadId: d.leadId, fromUserId: d.from, toUserId: d.to, actorId: user.id,
          method: mode === "UNASSIGNED" ? d.method : ("REASSIGNMENT" as const),
          reason: mode === "UNASSIGNED" ? "Automatic distribution" : "Previous owner absent",
          ruleId: d.ruleId, runId, idempotencyKey: `${runId}:${d.leadId}`,
        })),
      });
    }
    for (const [ruleId, cursor] of Object.entries(plan.cursors)) await tx.distributionRule.update({ where: { id: ruleId }, data: { cursorUserId: cursor } });

    const nameOf = new Map(inputs.agents.map((a) => [a.id, a.name]));
    const per = new Map<string, number>();
    for (const d of done) per.set(d.to, (per.get(d.to) ?? 0) + 1);
    const reasons = new Map<string, number>();
    for (const u of plan.unallocated) reasons.set(u.reason, (reasons.get(u.reason) ?? 0) + 1);
    if (raced) reasons.set("Changed by someone else while the run was in progress", raced);
    const result: RunSummary = {
      mode, assigned: done.length, unallocated: plan.unallocated.length + raced, raced,
      byAgent: [...per].map(([id, count]) => ({ name: nameOf.get(id) ?? id, count })).sort((a, b) => b.count - a.count),
      reasons: [...reasons].map(([reason, count]) => ({ reason, count })),
    };
    await tx.distributionRun.create({ data: { id: runId, actorId: user.id, mode, assigned: result.assigned, unallocated: result.unallocated, summary: result as unknown as Prisma.InputJsonValue } });
    return result;
  }, { timeout: 120_000, maxWait: 30_000 });

  if (!summary.alreadyApplied) {
    await audit({ actorId: user.id, action: "distribution.run", entityType: "DistributionRun", entityId: runId, after: { mode, assigned: summary.assigned, unallocated: summary.unallocated } });
  }
  return summary;
}

export async function listRuns(user: AuthUser) {
  assertCan(user, "distribution", "VIEW");
  const runs = await db.distributionRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  const actors = await db.user.findMany({ where: { id: { in: runs.map((r) => r.actorId) } }, select: { id: true, name: true } });
  const name = new Map(actors.map((a) => [a.id, a.name]));
  return runs.map((r) => ({ id: r.id, mode: r.mode, assigned: r.assigned, unallocated: r.unallocated, at: r.createdAt, actor: name.get(r.actorId) ?? "Unknown" }));
}

// ───────────── overview numbers + unworked alerts ─────────────

export async function getOverview(user: AuthUser) {
  assertCan(user, "distribution", "VIEW");
  const scope = await resolveScope(user);
  const { unworkedAfterHours } = await getDistributionSettings();
  const cutoff = new Date(Date.now() - unworkedAfterHours * 3_600_000);
  const unworkedWhere: Prisma.LeadWhereInput = { AND: [leadWhere(scope), unworkedClause(cutoff)] };

  const [unassigned, rules, pending, unworkedTotal, unworkedGroups] = await Promise.all([
    db.lead.count({ where: { AND: [leadWhere(scope), { ownerId: null, status: "NEW" }] } }),
    db.distributionRule.count({ where: { isActive: true, archivedAt: null } }),
    db.reassignmentRequest.count({ where: { status: "PENDING", lead: leadWhere(scope) } }),
    db.lead.count({ where: unworkedWhere }),
    db.lead.groupBy({ by: ["ownerId"], where: unworkedWhere, _count: { _all: true }, orderBy: { _count: { ownerId: "desc" } }, take: 10 }),
  ]);
  const names = await db.user.findMany({ where: { id: { in: unworkedGroups.flatMap((g) => (g.ownerId ? [g.ownerId] : [])) } }, select: { id: true, name: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const eligible = await db.user.count({ where: { AND: [userScopeWhere(scope), { role: { key: "TELECALLER" }, status: "ACTIVE", archivedAt: null, assignmentPaused: false }] } });
  return {
    unassigned, activeRules: rules, pendingApprovals: pending, eligibleAgents: eligible, unworkedAfterHours, unworkedTotal,
    unworkedByAgent: unworkedGroups.map((g) => ({ ownerId: g.ownerId, name: g.ownerId ? (nameOf.get(g.ownerId) ?? "Unknown") : "—", count: g._count._all })),
  };
}

// ───────────── rules ─────────────

export async function listRules(user: AuthUser) {
  assertCan(user, "distribution", "VIEW");
  const rules = await db.distributionRule.findMany({ where: { archivedAt: null }, orderBy: [{ priority: "asc" }, { name: "asc" }], include: { agents: { select: { userId: true } } } });
  const [campaigns, sources, teams] = await Promise.all([
    db.campaign.findMany({ select: { id: true, name: true } }), db.leadSource.findMany({ select: { id: true, name: true } }), db.team.findMany({ select: { id: true, name: true } }),
  ]);
  const nm = (xs: { id: string; name: string }[]) => new Map(xs.map((x) => [x.id, x.name]));
  const [c, s, t] = [nm(campaigns), nm(sources), nm(teams)];
  return rules.map((r) => ({ ...r, campaignName: r.campaignId ? c.get(r.campaignId) ?? null : null, sourceName: r.sourceId ? s.get(r.sourceId) ?? null : null, teamName: r.teamId ? t.get(r.teamId) ?? null : null, agentIds: r.agents.map((a) => a.userId) }));
}

export async function getRule(user: AuthUser, id: string) {
  const r = (await listRules(user)).find((x) => x.id === id);
  if (!r) throw notFound("Rule");
  return r;
}

export async function getRuleFormOptions(user: AuthUser) {
  assertCan(user, "distribution", "VIEW");
  const [campaigns, sources, teams, agents] = await Promise.all([
    db.campaign.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leadSource.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { key: "TELECALLER" }, status: "ACTIVE", archivedAt: null }, select: { id: true, name: true, team: { select: { name: true } } }, orderBy: { name: "asc" } }),
  ]);
  return { campaigns, sources, teams, agents };
}

export async function saveRule(user: AuthUser, id: string | null, input: RuleInput) {
  assertCan(user, "distribution", "MANAGE");
  if (input.campaignId && !(await db.campaign.findFirst({ where: { id: input.campaignId, archivedAt: null } }))) throw new AppError("VALIDATION_ERROR", "Unknown campaign.");
  if (input.sourceId && !(await db.leadSource.findFirst({ where: { id: input.sourceId, archivedAt: null } }))) throw new AppError("VALIDATION_ERROR", "Unknown source.");
  if (input.teamId && !(await db.team.findFirst({ where: { id: input.teamId, archivedAt: null } }))) throw new AppError("VALIDATION_ERROR", "Unknown team.");
  if (input.agentIds.length) {
    const ok = await db.user.count({ where: { id: { in: input.agentIds }, role: { key: "TELECALLER" }, status: "ACTIVE", archivedAt: null } });
    if (ok !== input.agentIds.length) throw new AppError("VALIDATION_ERROR", "Every chosen agent must be an active telecaller.");
  }
  const data = {
    name: input.name, method: input.method, priority: input.priority, isActive: input.isActive, campaignId: input.campaignId, sourceId: input.sourceId,
    minLeadPriority: input.minLeadPriority, matchCities: input.matchCities, matchStates: input.matchStates, teamId: input.teamId,
    maxActiveLeads: input.maxActiveLeads, dailyLimit: input.dailyLimit, fallbackToAny: input.fallbackToAny,
  };
  try {
    const before = id ? await db.distributionRule.findUnique({ where: { id }, include: { agents: true } }) : null;
    if (id && !before) throw notFound("Rule");
    const saved = await db.$transaction(async (tx) => {
      const rule = id ? await tx.distributionRule.update({ where: { id }, data }) : await tx.distributionRule.create({ data });
      await tx.distributionRuleAgent.deleteMany({ where: { ruleId: rule.id } });
      if (input.agentIds.length) await tx.distributionRuleAgent.createMany({ data: input.agentIds.map((userId) => ({ ruleId: rule.id, userId })) });
      return rule;
    });
    await audit({ actorId: user.id, action: id ? "distribution.rule_update" : "distribution.rule_create", entityType: "DistributionRule", entityId: saved.id, before: before ? JSON.parse(JSON.stringify(before)) : undefined, after: { ...data, agentIds: input.agentIds } as Prisma.InputJsonValue });
    return saved.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("CONFLICT", "A rule with that name already exists.");
    throw e;
  }
}

export async function setRuleActive(user: AuthUser, id: string, isActive: boolean) {
  assertCan(user, "distribution", "MANAGE");
  await db.distributionRule.update({ where: { id }, data: { isActive } });
  await audit({ actorId: user.id, action: "distribution.rule_toggle", entityType: "DistributionRule", entityId: id, after: { isActive } });
}

export async function archiveRule(user: AuthUser, id: string) {
  assertCan(user, "distribution", "MANAGE");
  await db.distributionRule.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } });
  await audit({ actorId: user.id, action: "distribution.rule_archive", entityType: "DistributionRule", entityId: id });
}

// ───────────── agents ─────────────

export async function listAgents(user: AuthUser) {
  assertCan(user, "distribution", "VIEW");
  const scope = await resolveScope(user);
  const now = new Date();
  const users = await db.user.findMany({
    where: { AND: [userScopeWhere(scope), { role: { key: "TELECALLER" }, status: "ACTIVE", archivedAt: null }] },
    select: { id: true, name: true, assignmentPaused: true, maxActiveLeads: true, dailyLeadLimit: true, serviceCities: true, serviceStates: true, team: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const ids = users.map((u) => u.id);
  const [active, today, att] = await Promise.all([
    db.lead.groupBy({ by: ["ownerId"], where: { ownerId: { in: ids }, archivedAt: null, status: { notIn: TERMINAL } }, _count: { _all: true } }),
    db.leadAssignment.groupBy({ by: ["toUserId"], where: { toUserId: { in: ids }, createdAt: { gte: startOfDayIST(now) } }, _count: { _all: true } }),
    db.attendance.findMany({ where: { userId: { in: ids }, date: new Date(`${dayKeyIST(now)}T00:00:00Z`) }, select: { userId: true, status: true } }),
  ]);
  const a = new Map(active.map((r) => [r.ownerId, r._count._all]));
  const t = new Map(today.map((r) => [r.toUserId, r._count._all]));
  const s = new Map(att.map((r) => [r.userId, r.status]));
  return users.map((u) => ({ ...u, team: u.team?.name ?? null, activeLeads: a.get(u.id) ?? 0, assignedToday: t.get(u.id) ?? 0, attendance: s.get(u.id) ?? null }));
}

export async function saveAgentSettings(
  user: AuthUser,
  input: { userId: string; assignmentPaused: boolean; maxActiveLeads: number | null; dailyLeadLimit: number | null; serviceCities: string[]; serviceStates: string[] },
) {
  assertCan(user, "distribution", "EDIT");
  const scope = await resolveScope(user);
  const target = await db.user.findFirst({ where: { AND: [{ id: input.userId }, userScopeWhere(scope), { role: { key: "TELECALLER" } }] } });
  if (!target) throw notFound("Agent");
  const data = { assignmentPaused: input.assignmentPaused, maxActiveLeads: input.maxActiveLeads, dailyLeadLimit: input.dailyLeadLimit, serviceCities: input.serviceCities, serviceStates: input.serviceStates };
  await db.user.update({ where: { id: target.id }, data });
  await audit({
    actorId: user.id, action: "distribution.agent_settings", entityType: "User", entityId: target.id,
    before: { assignmentPaused: target.assignmentPaused, maxActiveLeads: target.maxActiveLeads, dailyLeadLimit: target.dailyLeadLimit, serviceCities: target.serviceCities, serviceStates: target.serviceStates },
    after: data,
  });
}

// ───────────── approval-based reassignment ─────────────

export async function listApprovals(user: AuthUser) {
  assertCan(user, "distribution", "VIEW");
  const scope = await resolveScope(user);
  const include = { lead: { select: { id: true, leadCode: true, name: true } }, toUser: { select: { name: true } }, requester: { select: { name: true } } } as const;
  const [pending, recent] = await Promise.all([
    db.reassignmentRequest.findMany({ where: { status: "PENDING", lead: leadWhere(scope) }, orderBy: { createdAt: "asc" }, take: 100, include }),
    db.reassignmentRequest.findMany({ where: { status: { not: "PENDING" }, lead: leadWhere(scope) }, orderBy: { decidedAt: "desc" }, take: 20, include }),
  ]);
  const ids = [...pending, ...recent].flatMap((r) => [r.fromUserId, r.decidedById].filter((x): x is string => !!x));
  const people = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nm = new Map(people.map((p) => [p.id, p.name]));
  const shape = (r: (typeof pending)[number]) => ({ ...r, fromName: r.fromUserId ? nm.get(r.fromUserId) ?? "Unknown" : null, decidedByName: r.decidedById ? nm.get(r.decidedById) ?? "Unknown" : null });
  return { pending: pending.map(shape), recent: recent.map(shape) };
}

export async function decideRequest(user: AuthUser, id: string, approve: boolean, note?: string) {
  assertCan(user, "distribution", "APPROVE");
  const req = await db.reassignmentRequest.findUnique({ where: { id } });
  if (!req) throw notFound("Request");
  await getAccessibleLead(user, req.leadId); // must be inside the approver's own scope
  if (req.status !== "PENDING") throw new AppError("CONFLICT", "This request has already been decided.");
  const decided = { decidedById: user.id, decidedAt: new Date(), pendingKey: null };

  if (!approve) {
    await db.reassignmentRequest.update({ where: { id }, data: { ...decided, status: "REJECTED", decisionNote: note ?? null } });
    await audit({ actorId: user.id, action: "reassignment.reject", entityType: "ReassignmentRequest", entityId: id });
    return { approved: false, message: "Request rejected." };
  }

  const target = await db.user.findFirst({ where: { id: req.toUserId, status: "ACTIVE", archivedAt: null, role: { key: { in: ["TELECALLER", "TEAM_LEADER"] } } }, select: { teamId: true } });
  const outcome = await db.$transaction(async (tx) => {
    if (!target) {
      await tx.reassignmentRequest.update({ where: { id }, data: { ...decided, status: "REJECTED", decisionNote: "Automatically rejected: the new owner is no longer available." } });
      return "The new owner is no longer available, so the request was rejected.";
    }
    // Compare-and-swap: only move the lead if it still belongs to the person it belonged to when requested.
    const moved = await tx.lead.updateMany({ where: { id: req.leadId, ownerId: req.fromUserId, archivedAt: null }, data: { ownerId: req.toUserId, teamId: target.teamId } });
    if (moved.count !== 1) {
      await tx.reassignmentRequest.update({ where: { id }, data: { ...decided, status: "REJECTED", decisionNote: "Automatically rejected: the lead's owner changed after this request." } });
      return "The lead's owner changed since this was requested, so it was rejected automatically.";
    }
    await tx.leadAssignment.create({
      data: { leadId: req.leadId, fromUserId: req.fromUserId, toUserId: req.toUserId, actorId: user.id, method: "REASSIGNMENT", approval: "APPROVED", reason: req.reason, idempotencyKey: `req:${id}` },
    });
    await tx.reassignmentRequest.update({ where: { id }, data: { ...decided, status: "APPROVED", decisionNote: note ?? null } });
    return null;
  });
  await audit({ actorId: user.id, action: outcome ? "reassignment.auto_reject" : "reassignment.approve", entityType: "ReassignmentRequest", entityId: id });
  if (outcome) throw new AppError("CONFLICT", outcome);
  return { approved: true, message: "Approved and reassigned." };
}
