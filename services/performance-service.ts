import "server-only";
import { Prisma, type TargetMetric, type TargetPeriod } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { percent } from "@/lib/dashboard-series";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { dayKeyIST } from "@/lib/date-range";
import { AppError, notFound } from "@/lib/errors";
import { currentWindow, percentOf, periodKindForPreset } from "@/lib/performance/periods";
import { audit } from "./audit-service";
import { directoryWhere } from "./employee-service";

export type AgentMetrics = { attempts: number; connected: number; interested: number; conversions: number; followUps: number; avgTalkSec: number | null; qaScore: number | null; qaReviews: number };
const EMPTY: AgentMetrics = { attempts: 0, connected: 0, interested: 0, conversions: 0, followUps: 0, avgTalkSec: null, qaScore: null, qaReviews: 0 };

export const METRIC_FIELD: Record<TargetMetric, keyof AgentMetrics> = {
  CALL_ATTEMPTS: "attempts", CONNECTED_CALLS: "connected", INTERESTED_LEADS: "interested", CONVERSIONS: "conversions", FOLLOWUPS_COMPLETED: "followUps",
};
export const METRIC_LABELS: Record<TargetMetric, string> = {
  CALL_ATTEMPTS: "Call attempts", CONNECTED_CALLS: "Connected calls", INTERESTED_LEADS: "Interested leads", CONVERSIONS: "Conversions", FOLLOWUPS_COMPLETED: "Follow-ups completed",
};

/** One place that defines every performance number, so the table, targets, incentives and reports always agree. */
export async function computeMetrics(agentIds: string[], from: Date, to: Date): Promise<Map<string, AgentMetrics>> {
  const out = new Map<string, AgentMetrics>(agentIds.map((id) => [id, { ...EMPTY }]));
  if (agentIds.length === 0) return out;
  const range = { gte: from, lt: to };
  const calls = { agentId: { in: agentIds }, createdAt: range };

  const [attempts, connected, interested, convCalls, convStatus, followUps, talk, qa] = await Promise.all([
    db.callLog.groupBy({ by: ["agentId"], where: calls, _count: { _all: true } }),
    db.callLog.groupBy({ by: ["agentId"], where: { ...calls, disposition: { isConnected: true } }, _count: { _all: true } }),
    db.callLog.groupBy({ by: ["agentId", "leadId"], where: { ...calls, disposition: { key: "INTERESTED" } } }),
    db.callLog.groupBy({ by: ["agentId", "leadId"], where: { ...calls, disposition: { key: "CONVERTED" } } }),
    db.leadActivity.groupBy({ by: ["actorId", "leadId"], where: { type: "STATUS_CHANGED", actorId: { in: agentIds }, createdAt: range, data: { path: ["to"], equals: "CONVERTED" } } }),
    db.followUp.groupBy({ by: ["ownerId"], where: { ownerId: { in: agentIds }, status: "COMPLETED", completedAt: range }, _count: { _all: true } }),
    db.callLog.groupBy({ by: ["agentId"], where: { ...calls, disposition: { isConnected: true }, durationSec: { not: null } }, _avg: { durationSec: true } }),
    db.qaReview.groupBy({ by: ["agentId"], where: { agentId: { in: agentIds }, createdAt: range, score: { not: null } }, _avg: { score: true }, _count: { _all: true } }),
  ]);

  const m = (id: string) => out.get(id)!;
  for (const r of attempts) m(r.agentId).attempts = r._count._all;
  for (const r of connected) m(r.agentId).connected = r._count._all;
  const countDistinct = (pairs: { id: string | null; leadId: string }[]) => {
    const sets = new Map<string, Set<string>>();
    for (const p of pairs) if (p.id) (sets.get(p.id) ?? sets.set(p.id, new Set()).get(p.id)!).add(p.leadId);
    return sets;
  };
  for (const [id, s] of countDistinct(interested.map((r) => ({ id: r.agentId, leadId: r.leadId })))) m(id).interested = s.size;
  const conv = countDistinct([...convCalls.map((r) => ({ id: r.agentId, leadId: r.leadId })), ...convStatus.map((r) => ({ id: r.actorId, leadId: r.leadId }))]);
  for (const [id, s] of conv) if (out.has(id)) m(id).conversions = s.size;
  for (const r of followUps) m(r.ownerId).followUps = r._count._all;
  for (const r of talk) m(r.agentId).avgTalkSec = r._avg.durationSec === null ? null : Math.round(r._avg.durationSec);
  for (const r of qa) { m(r.agentId).qaScore = r._avg.score === null ? null : Math.round(r._avg.score * 10) / 10; m(r.agentId).qaReviews = r._count._all; }
  return out;
}

export type StatRow = AgentMetrics & { id: string; name: string; team: string | null; connectRate: number | null; conversionRate: number | null; targetValue: number | null; targetAchievement: number | null };

export async function getAgentStats(user: AuthUser, f: Pick<DashboardFilters, "range" | "teamId">) {
  assertCan(user, "performance", "VIEW");
  const where = user.roleKey === "TELECALLER"
    ? { id: user.id }
    : { AND: [await directoryWhere(user), { status: "ACTIVE" as const, role: { key: "TELECALLER" }, ...(f.teamId ? { teamId: f.teamId } : {}) }] };
  const agents = await db.user.findMany({ where, select: { id: true, name: true, team: { select: { name: true } } }, orderBy: { name: "asc" }, take: 500 });
  const metrics = await computeMetrics(agents.map((a) => a.id), f.range.from, f.range.to);

  // A target is only compared when the chosen period lines up with the target's own period (see docs/METRICS.md).
  const kind = periodKindForPreset(f.range.preset);
  const targets = kind ? await db.target.findMany({ where: { userId: { in: agents.map((a) => a.id) }, metric: "CALL_ATTEMPTS", period: kind, startsOn: { lte: f.range.from }, OR: [{ endsOn: null }, { endsOn: { gte: f.range.from } }] }, orderBy: { startsOn: "desc" } }) : [];
  const targetOf = new Map<string, number>();
  for (const t of targets) if (t.userId && !targetOf.has(t.userId)) targetOf.set(t.userId, t.value);

  const rows: StatRow[] = agents.map((a) => {
    const x = metrics.get(a.id)!;
    const tv = targetOf.get(a.id) ?? null;
    return { ...x, id: a.id, name: a.name, team: a.team?.name ?? null, connectRate: percent(x.connected, x.attempts), conversionRate: percent(x.conversions, x.connected), targetValue: tv, targetAchievement: tv ? percentOf(x.attempts, tv) : null };
  });
  // Ordered by outcomes. Call volume alone never decides the order.
  rows.sort((a, b) => b.conversions - a.conversions || (b.conversionRate ?? 0) - (a.conversionRate ?? 0) || b.connected - a.connected || a.name.localeCompare(b.name));
  return { rows, comparesTargets: !!kind };
}

export async function getMyQaFeedback(user: AuthUser) {
  return db.qaReview.findMany({ where: { agentId: user.id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, score: true, feedback: true, coachingNotes: true, createdAt: true, reviewer: { select: { name: true } } } });
}

// ───────────── targets ─────────────

export async function listTargets(user: AuthUser) {
  assertCan(user, "performance", "VIEW");
  const dir = await directoryWhere(user);
  const people = await db.user.findMany({ where: { AND: [dir, { status: "ACTIVE", role: { key: "TELECALLER" } }] }, select: { id: true, name: true, teamId: true }, take: 500 });
  const teamIds = [...new Set(people.map((p) => p.teamId).filter((x): x is string => !!x))];
  const targets = await db.target.findMany({ where: { OR: [{ userId: { in: people.map((p) => p.id) } }, { teamId: { in: teamIds } }] }, orderBy: [{ period: "asc" }, { startsOn: "desc" }], take: 200 });
  const teams = await db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } });
  const tn = new Map(teams.map((t) => [t.id, t.name])), pn = new Map(people.map((p) => [p.id, p.name]));

  const now = new Date();
  const out = [];
  for (const t of targets) {
    const w = currentWindow(t.period, now);
    const ids = t.userId ? [t.userId] : people.filter((p) => p.teamId === t.teamId).map((p) => p.id);
    const active = t.startsOn <= now && (!t.endsOn || t.endsOn >= new Date(dayKeyIST(now) + "T00:00:00Z"));
    const mm = active ? await computeMetrics(ids, w.from, w.to) : new Map<string, AgentMetrics>();
    const value = ids.reduce((n, id) => n + (mm.get(id)?.[METRIC_FIELD[t.metric]] as number ?? 0), 0);
    out.push({ ...t, subject: t.userId ? (pn.get(t.userId) ?? "Unknown") : `Team: ${tn.get(t.teamId!) ?? "Unknown"}`, active, current: value, achievement: active ? percentOf(value, t.value) : null });
  }
  return { targets: out, people: people.map((p) => ({ id: p.id, name: p.name })), teams };
}

export async function saveTarget(user: AuthUser, input: { userId?: string; teamId?: string; metric: TargetMetric; period: TargetPeriod; value: number; startsOn: string; endsOn?: string }) {
  assertCan(user, "performance", "EDIT");
  const dir = await directoryWhere(user);
  if (input.userId && !(await db.user.findFirst({ where: { AND: [{ id: input.userId }, dir, { role: { key: "TELECALLER" } }] } }))) throw notFound("Telecaller");
  if (input.teamId) {
    const inScope = await db.user.findFirst({ where: { AND: [dir, { teamId: input.teamId }] } });
    if (!inScope && !["SUPER_ADMIN", "ADMIN"].includes(user.roleKey)) throw notFound("Team");
  }
  if (input.endsOn && input.endsOn < input.startsOn) throw new AppError("VALIDATION_ERROR", "The end date must be after the start date.");
  const t = await db.target.create({ data: { userId: input.userId ?? null, teamId: input.teamId ?? null, metric: input.metric, period: input.period, value: input.value, startsOn: new Date(`${input.startsOn}T00:00:00Z`), endsOn: input.endsOn ? new Date(`${input.endsOn}T00:00:00Z`) : null } });
  await audit({ actorId: user.id, action: "target.create", entityType: "Target", entityId: t.id, after: { ...input } as Prisma.InputJsonValue });
}

export async function deleteTarget(user: AuthUser, id: string) {
  assertCan(user, "performance", "EDIT");
  const t = await db.target.findUnique({ where: { id } });
  if (!t) throw notFound("Target");
  const dir = await directoryWhere(user);
  const ok = t.userId ? await db.user.findFirst({ where: { AND: [{ id: t.userId }, dir] } }) : await db.user.findFirst({ where: { AND: [dir, { teamId: t.teamId }] } });
  if (!ok && !["SUPER_ADMIN", "ADMIN"].includes(user.roleKey)) throw notFound("Target");
  await db.target.delete({ where: { id } });
  await audit({ actorId: user.id, action: "target.delete", entityType: "Target", entityId: id });
}
