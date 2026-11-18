import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import {
  callScopeWhere, followUpScopeWhere, leadWhere, taskScopeWhere, userScopeWhere, type DataScope,
} from "@/lib/auth/scope";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { fillSeries, percent, type DailyRow } from "@/lib/dashboard-series";
import { addDays, startOfDayIST } from "@/lib/date-range";
import type {
  AgentRow, DashboardData, FilterOptions, GroupRow, TeamRow,
} from "@/types/dashboard";
import { resolveScope } from "./scope-service";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";

const CONVERTED_CALL: Prisma.LeadWhereInput = { calls: { some: { disposition: { key: "CONVERTED" } } } };

// Same boundary as callScopeWhere(), expressed for the raw SQL daily query.
function callScopeSql(scope: DataScope): Prisma.Sql {
  switch (scope.kind) {
    case "ALL":
      return Prisma.empty;
    case "OWN":
      return Prisma.sql`AND c."agentId" = ${scope.userId}`;
    case "NONE":
      return Prisma.sql`AND FALSE`;
    case "TEAMS":
      return scope.teamIds.length
        ? Prisma.sql`AND (c."agentId" = ${scope.userId} OR l."teamId" IN (${Prisma.join(scope.teamIds)}) OR a."teamId" IN (${Prisma.join(scope.teamIds)}))`
        : Prisma.sql`AND c."agentId" = ${scope.userId}`;
  }
}

export async function getDashboardData(user: AuthUser, f: DashboardFilters): Promise<DashboardData> {
  assertCan(user, "dashboard", "VIEW");
  
  // Try cache first
  const cacheKey = `dashboard:metrics:${user.id}:${f.range.from.getTime()}-${f.range.to.getTime()}:${f.teamId ?? 'all'}:${f.campaignId ?? 'all'}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as DashboardData;
    } catch {
      await cacheDel(cacheKey);
    }
  }
  
  const scope = await resolveScope(user);

  const now = new Date();
  const todayStart = startOfDayIST(now);
  const todayEnd = addDays(todayStart, 1);
  const inRange = { gte: f.range.from, lt: f.range.to };

  // Scope first, then the user's optional team/campaign filters narrow it further (never widen it).
  const leadFilter: Prisma.LeadWhereInput = {
    AND: [leadWhere(scope), f.teamId ? { teamId: f.teamId } : {}, f.campaignId ? { campaignId: f.campaignId } : {}],
  };
  const callBase: Prisma.CallLogWhereInput = {
    AND: [
      callScopeWhere(scope),
      f.teamId ? { agent: { teamId: f.teamId } } : {},
      f.campaignId ? { lead: { campaignId: f.campaignId } } : {},
    ],
  };
  const callRange: Prisma.CallLogWhereInput = { AND: [callBase, { createdAt: inRange }] };
  const connectedCalls: Prisma.CallLogWhereInput = { AND: [callRange, { disposition: { isConnected: true } }] };
  const convertedCalls: Prisma.CallLogWhereInput = { AND: [callRange, { disposition: { key: "CONVERTED" } }] };
  const followUpBase: Prisma.FollowUpWhereInput = {
    AND: [
      followUpScopeWhere(scope),
      f.teamId ? { owner: { teamId: f.teamId } } : {},
      f.campaignId ? { lead: { campaignId: f.campaignId } } : {},
    ],
  };
  const cohort: Prisma.LeadWhereInput = { AND: [leadFilter, { createdAt: inRange }] };

  const dailyRows = db.$queryRaw<DailyRow[]>(Prisma.sql`
    SELECT to_char(((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS attempts,
           COUNT(*) FILTER (WHERE d."isConnected")::int AS connected
    FROM "CallLog" c
    LEFT JOIN "CallDisposition" d ON d.id = c."dispositionId"
    LEFT JOIN "Lead" l ON l.id = c."leadId"
    LEFT JOIN "User" a ON a.id = c."agentId"
    WHERE c."createdAt" >= ${f.range.from} AND c."createdAt" < ${f.range.to}
      ${callScopeSql(scope)}
      ${f.teamId ? Prisma.sql`AND a."teamId" = ${f.teamId}` : Prisma.empty}
      ${f.campaignId ? Prisma.sql`AND l."campaignId" = ${f.campaignId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1`);

  const [
    totalLeads, newToday, assigned, attempts, connected, interested, followUpsDue, convertedGroups,
    activeTelecallers, pendingTasks,
    created, contacted, funnelConnected, funnelInterested, funnelConverted,
    sourceTotals, sourceConv, campaignTotals, campaignConv,
    agentAll, agentConnected, agentConverted,
    fuByStatus, fuOverdue,
    daily,
    assignments, conversions, alerts, notifications,
  ] = await Promise.all([
    db.lead.count({ where: leadFilter }),
    db.lead.count({ where: { AND: [leadFilter, { createdAt: { gte: todayStart, lt: todayEnd } }] } }),
    db.lead.count({ where: { AND: [leadFilter, { ownerId: { not: null } }] } }),
    db.callLog.count({ where: callRange }),
    db.callLog.count({ where: connectedCalls }),
    db.lead.count({ where: { AND: [leadFilter, { status: "INTERESTED" }] } }),
    db.followUp.count({ where: { AND: [followUpBase, { status: "PENDING", dueAt: { lt: todayEnd } }] } }),
    // Converted = a "Converted" call OR a status change to Converted in the period (status history exists since Phase 05).
    (async () => {
      const [fromCalls, fromStatus] = await Promise.all([
        db.callLog.findMany({ where: convertedCalls, distinct: ["leadId"], select: { leadId: true } }),
        db.leadActivity.findMany({
          where: { type: "STATUS_CHANGED", createdAt: inRange, data: { path: ["to"], equals: "CONVERTED" }, lead: leadFilter },
          distinct: ["leadId"], select: { leadId: true },
        }),
      ]);
      return [...new Set([...fromCalls, ...fromStatus].map((x) => x.leadId))];
    })(),
    db.user.count({
      where: {
        AND: [userScopeWhere(scope), f.teamId ? { teamId: f.teamId } : {}, { role: { key: "TELECALLER" }, status: "ACTIVE", archivedAt: null }],
      },
    }),
    db.task.count({
      where: { AND: [taskScopeWhere(scope), f.teamId ? { owner: { teamId: f.teamId } } : {}, { status: { in: ["OPEN", "IN_PROGRESS"] } }] },
    }),

    // Funnel: leads created in the period, and how far they progressed (any time since).
    db.lead.count({ where: cohort }),
    db.lead.count({ where: { AND: [cohort, { calls: { some: {} } }] } }),
    db.lead.count({ where: { AND: [cohort, { calls: { some: { disposition: { isConnected: true } } } }] } }),
    db.lead.count({
      where: {
        AND: [cohort, { OR: [{ status: { in: ["INTERESTED", "QUALIFIED", "CONVERTED"] } }, { calls: { some: { disposition: { key: { in: ["INTERESTED", "CONVERTED"] } } } } }] }],
      },
    }),
    db.lead.count({ where: { AND: [cohort, CONVERTED_CALL] } }),

    db.lead.groupBy({ by: ["sourceId"], where: cohort, _count: { _all: true } }),
    db.lead.groupBy({ by: ["sourceId"], where: { AND: [cohort, CONVERTED_CALL] }, _count: { _all: true } }),
    db.lead.groupBy({ by: ["campaignId"], where: cohort, _count: { _all: true } }),
    db.lead.groupBy({ by: ["campaignId"], where: { AND: [cohort, CONVERTED_CALL] }, _count: { _all: true } }),

    db.callLog.groupBy({ by: ["agentId"], where: callRange, _count: { _all: true } }),
    db.callLog.groupBy({ by: ["agentId"], where: connectedCalls, _count: { _all: true } }),
    db.callLog.groupBy({ by: ["agentId"], where: convertedCalls, _count: { _all: true } }),

    db.followUp.groupBy({ by: ["status"], where: { AND: [followUpBase, { dueAt: inRange }] }, _count: { _all: true } }),
    db.followUp.count({ where: { AND: [followUpBase, { dueAt: { ...inRange, lt: now < f.range.to ? now : f.range.to }, status: "PENDING" }] } }),

    dailyRows,

    db.leadAssignment.findMany({
      where: { lead: leadFilter },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { lead: { select: { name: true, leadCode: true } }, toUser: { select: { name: true } }, actor: { select: { name: true } } },
    }),
    db.callLog.findMany({
      where: { AND: [callBase, { disposition: { key: "CONVERTED" } }] },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { lead: { select: { name: true, leadCode: true } }, agent: { select: { name: true } } },
    }),
    db.followUp.findMany({
      where: { AND: [followUpBase, { status: "PENDING", dueAt: { lt: now } }] },
      orderBy: { dueAt: "asc" },
      take: 6,
      include: { lead: { select: { name: true, leadCode: true } }, owner: { select: { name: true } } },
    }),
    db.notification.findMany({
      where: { userId: user.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  // ---- names for grouped rows ----
  const sourceIds = sourceTotals.map((r) => r.sourceId).filter((x): x is string => !!x);
  const campaignIds = campaignTotals.map((r) => r.campaignId).filter((x): x is string => !!x);
  const agentIds = agentAll.map((r) => r.agentId);
  const [sourceNames, campaignNames, agentUsers] = await Promise.all([
    db.leadSource.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true } }),
    db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } }),
    db.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, team: { select: { name: true } } } }),
  ]);

  const groupRows = (
    totals: { id: string | null; n: number }[], conv: { id: string | null; n: number }[], names: { id: string; name: string }[], unknown: string,
  ): GroupRow[] => {
    const nameOf = new Map(names.map((x) => [x.id, x.name]));
    const convOf = new Map(conv.map((x) => [x.id, x.n]));
    return totals
      .map((t) => ({
        name: t.id ? (nameOf.get(t.id) ?? unknown) : unknown,
        leads: t.n,
        converted: convOf.get(t.id) ?? 0,
        conversionRate: percent(convOf.get(t.id) ?? 0, t.n),
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  };

  const sources = groupRows(
    sourceTotals.map((r) => ({ id: r.sourceId, n: r._count._all })),
    sourceConv.map((r) => ({ id: r.sourceId, n: r._count._all })),
    sourceNames, "No source",
  );
  const campaigns = groupRows(
    campaignTotals.map((r) => ({ id: r.campaignId, n: r._count._all })),
    campaignConv.map((r) => ({ id: r.campaignId, n: r._count._all })),
    campaignNames, "No campaign",
  );

  const userOf = new Map(agentUsers.map((u) => [u.id, u]));
  const connOf = new Map(agentConnected.map((r) => [r.agentId, r._count._all]));
  const convOfAgent = new Map(agentConverted.map((r) => [r.agentId, r._count._all]));
  const allAgents: AgentRow[] = agentAll.map((r) => {
    const u = userOf.get(r.agentId);
    return {
      name: u?.name ?? "Unknown",
      team: u?.team?.name ?? "No team",
      attempts: r._count._all,
      connected: connOf.get(r.agentId) ?? 0,
      conversions: convOfAgent.get(r.agentId) ?? 0,
      connectRate: percent(connOf.get(r.agentId) ?? 0, r._count._all),
    };
  });
  // Ranked by outcomes first; call volume alone does not decide the order.
  const agents = [...allAgents]
    .sort((a, b) => b.conversions - a.conversions || b.connected - a.connected || b.attempts - a.attempts)
    .slice(0, 10);

  const teamMap = new Map<string, TeamRow>();
  for (const a of allAgents) {
    const t = teamMap.get(a.team) ?? { name: a.team, attempts: 0, connected: 0, conversions: 0 };
    t.attempts += a.attempts;
    t.connected += a.connected;
    t.conversions += a.conversions;
    teamMap.set(a.team, t);
  }
  const teams = [...teamMap.values()].sort((a, b) => b.conversions - a.conversions || b.connected - a.connected);

  const fu = new Map(fuByStatus.map((r) => [r.status, r._count._all]));
  const pendingTotal = fu.get("PENDING") ?? 0;
  const completed = fu.get("COMPLETED") ?? 0;
  const missed = fu.get("MISSED") ?? 0;
  const overduePending = Math.min(fuOverdue, pendingTotal);

  const result: DashboardData = {
    kpis: [
      { key: "totalLeads", label: "Total leads", value: totalLeads, basis: "snapshot" },
      { key: "newToday", label: "New leads today", value: newToday, basis: "snapshot" },
      { key: "assigned", label: "Assigned leads", value: assigned, basis: "snapshot" },
      { key: "attempts", label: "Call attempts", value: attempts, basis: "period" },
      { key: "connected", label: "Connected calls", value: connected, basis: "period" },
      { key: "interested", label: "Interested leads", value: interested, basis: "snapshot" },
      { key: "followUpsDue", label: "Follow-ups due", value: followUpsDue, basis: "snapshot" },
      { key: "converted", label: "Converted leads", value: convertedGroups.length, basis: "period" },
      { key: "activeTelecallers", label: "Active telecallers", value: activeTelecallers, basis: "snapshot", note: f.campaignId ? "Not filtered by campaign" : undefined },
      { key: "pendingTasks", label: "Pending tasks", value: pendingTasks, basis: "snapshot", note: f.campaignId ? "Not filtered by campaign" : undefined },
    ],
    daily: fillSeries(daily, f.range.from, f.range.to),
    funnel: [
      { stage: "Leads created", count: created },
      { stage: "Contacted", count: contacted },
      { stage: "Connected", count: funnelConnected },
      { stage: "Interested", count: funnelInterested },
      { stage: "Converted", count: funnelConverted },
    ],
    sources,
    campaigns,
    agents,
    teams,
    followUps: {
      completed, missed, overduePending,
      upcomingPending: pendingTotal - overduePending,
      rescheduled: fu.get("RESCHEDULED") ?? 0,
      completionRate: percent(completed, completed + missed + overduePending),
    },
    recent: {
      assignments: assignments.map((a) => ({
        id: a.id, leadName: a.lead.name, leadCode: a.lead.leadCode, toName: a.toUser?.name ?? null,
        actorName: a.actor?.name ?? null, method: a.method, at: a.createdAt,
      })),
      conversions: conversions.map((c) => ({ id: c.id, leadName: c.lead.name, leadCode: c.lead.leadCode, agentName: c.agent.name, at: c.createdAt })),
      followUpAlerts: alerts.map((a) => ({ id: a.id, leadName: a.lead.name, leadCode: a.lead.leadCode, ownerName: a.owner.name, dueAt: a.dueAt })),
      notifications: notifications.map((n) => ({ id: n.id, title: n.title, at: n.createdAt, read: !!n.readAt })),
    },
  };
  
  // Cache result for 2 minutes (120 seconds)
  await cacheSet(cacheKey, JSON.stringify(result), 120);
  
  return result;
}

/** Team/campaign choices limited to what the user is allowed to see. */
export async function getFilterOptions(user: AuthUser): Promise<FilterOptions> {
  const scope = await resolveScope(user);
  const teamWhere: Prisma.TeamWhereInput =
    scope.kind === "ALL" ? { archivedAt: null }
    : scope.kind === "TEAMS" ? { archivedAt: null, id: { in: scope.teamIds } }
    : { id: { in: [] } };
  const [teams, campaigns] = await Promise.all([
    db.team.findMany({ where: teamWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    scope.kind === "NONE" || scope.kind === "OWN"
      ? Promise.resolve([])
      : db.campaign.findMany({ where: { archivedAt: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { teams, campaigns };
}
