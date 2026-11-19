import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { callScopeWhere, leadWhere } from "@/lib/auth/scope";
import type {
  AgentPerformance,
  AnalyticsFilters,
  AnalyticsSummary,
  CallPatternData,
  ChannelPerformance,
  CohortRow,
  FunnelStageAdvanced,
  KPIComparison,
  TrendPoint,
} from "@/types/analytics";
import { resolveScope } from "./scope-service";
import { cacheGet, cacheSet } from "@/lib/redis";
import { conversionRate, getTrend, percentageChange, round } from "@/lib/analytics/metrics";
import { calculateCohortMetrics, formatCohortLabel, getCohortKey, sortCohortsDesc } from "@/lib/analytics/cohorts";
import { movingAverage } from "@/lib/analytics/trends";

const CACHE_TTL_SEC = 300; // 5 minutes

/**
 * Get comprehensive analytics data for the dashboard
 */
export async function getAnalyticsData(
  user: AuthUser,
  filters: AnalyticsFilters
): Promise<AnalyticsSummary> {
  assertCan(user, "analytics", "VIEW");

  // Try cache first
  const cacheKey = `analytics:full:${user.id}:${filters.range.from.getTime()}-${filters.range.to.getTime()}:${filters.teamId ?? "all"}:${filters.campaignId ?? "all"}:${filters.sourceId ?? "all"}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as AnalyticsSummary;
    } catch {
      // Cache corrupted, continue to compute
    }
  }

  const scope = await resolveScope(user);
  const { from, to } = filters.range;

  // Build base filters with scope
  const leadFilter: Prisma.LeadWhereInput = {
    AND: [
      leadWhere(scope),
      filters.teamId ? { teamId: filters.teamId } : {},
      filters.campaignId ? { campaignId: filters.campaignId } : {},
      filters.sourceId ? { sourceId: filters.sourceId } : {},
    ],
  };

  const callFilter: Prisma.CallLogWhereInput = {
    AND: [
      callScopeWhere(scope),
      filters.teamId ? { agent: { teamId: filters.teamId } } : {},
      filters.campaignId ? { lead: { campaignId: filters.campaignId } } : {},
    ],
  };

  // Calculate previous period for comparisons
  const rangeMs = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - rangeMs);
  const previousTo = from;

  // Fetch all data in parallel
  const [
    overview,
    comparisons,
    funnel,
    callPatterns,
    cohorts,
    channels,
    topAgents,
    trends,
  ] = await Promise.all([
    getOverviewMetrics(leadFilter, callFilter, from, to),
    getKPIComparisons(leadFilter, callFilter, from, to, previousFrom, previousTo),
    getFunnelAnalytics(leadFilter, from, to),
    getCallPatterns(callFilter, from, to),
    getCohortAnalytics(leadFilter, from, to),
    getChannelPerformance(leadFilter, from, to),
    getTopAgents(scope, filters, from, to, 10),
    getTrendData(leadFilter, callFilter, from, to),
  ]);

  const result: AnalyticsSummary = {
    overview,
    comparisons,
    funnel,
    callPatterns,
    cohorts,
    channels,
    teamTrends: [], // TODO: Implement team trends
    topAgents,
    trends,
  };

  // Cache the result
  await cacheSet(cacheKey, JSON.stringify(result), CACHE_TTL_SEC);

  return result;
}

/**
 * Get overview metrics (total leads, conversion rate, calls today, active follow-ups)
 */
async function getOverviewMetrics(
  leadFilter: Prisma.LeadWhereInput,
  callFilter: Prisma.CallLogWhereInput,
  from: Date,
  to: Date
) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [totalLeads, convertedLeads, callsToday, activeFollowUps] = await Promise.all([
    db.lead.count({ where: { AND: [leadFilter, { createdAt: { gte: from, lt: to } }] } }),
    db.lead.count({
      where: {
        AND: [
          leadFilter,
          { createdAt: { gte: from, lt: to } },
          { calls: { some: { disposition: { key: "CONVERTED" } } } },
        ],
      },
    }),
    db.callLog.count({
      where: {
        AND: [callFilter, { createdAt: { gte: todayStart, lt: todayEnd } }],
      },
    }),
    db.followUp.count({
      where: {
        status: "PENDING",
        dueAt: { lte: now },
      },
    }),
  ]);

  return {
    totalLeads,
    conversionRate: round(conversionRate(convertedLeads, totalLeads), 2),
    callsToday,
    activeFollowUps,
  };
}

/**
 * Get KPI comparisons between current and previous period
 */
async function getKPIComparisons(
  leadFilter: Prisma.LeadWhereInput,
  callFilter: Prisma.CallLogWhereInput,
  currentFrom: Date,
  currentTo: Date,
  previousFrom: Date,
  previousTo: Date
): Promise<KPIComparison[]> {
  // Current period metrics
  const [currentLeads, currentConverted, currentCalls, currentConnected] = await Promise.all([
    db.lead.count({ where: { AND: [leadFilter, { createdAt: { gte: currentFrom, lt: currentTo } }] } }),
    db.lead.count({
      where: {
        AND: [
          leadFilter,
          { createdAt: { gte: currentFrom, lt: currentTo } },
          { calls: { some: { disposition: { key: "CONVERTED" } } } },
        ],
      },
    }),
    db.callLog.count({ where: { AND: [callFilter, { createdAt: { gte: currentFrom, lt: currentTo } }] } }),
    db.callLog.count({
      where: {
        AND: [
          callFilter,
          { createdAt: { gte: currentFrom, lt: currentTo } },
          { disposition: { isConnected: true } },
        ],
      },
    }),
  ]);

  // Previous period metrics
  const [previousLeads, previousConverted, previousCalls, previousConnected] = await Promise.all([
    db.lead.count({ where: { AND: [leadFilter, { createdAt: { gte: previousFrom, lt: previousTo } }] } }),
    db.lead.count({
      where: {
        AND: [
          leadFilter,
          { createdAt: { gte: previousFrom, lt: previousTo } },
          { calls: { some: { disposition: { key: "CONVERTED" } } } },
        ],
      },
    }),
    db.callLog.count({ where: { AND: [callFilter, { createdAt: { gte: previousFrom, lt: previousTo } }] } }),
    db.callLog.count({
      where: {
        AND: [
          callFilter,
          { createdAt: { gte: previousFrom, lt: previousTo } },
          { disposition: { isConnected: true } },
        ],
      },
    }),
  ]);

  return [
    {
      label: "Total Leads",
      current: currentLeads,
      previous: previousLeads,
      change: round(percentageChange(currentLeads, previousLeads), 1),
      trend: getTrend(percentageChange(currentLeads, previousLeads)),
    },
    {
      label: "Conversions",
      current: currentConverted,
      previous: previousConverted,
      change: round(percentageChange(currentConverted, previousConverted), 1),
      trend: getTrend(percentageChange(currentConverted, previousConverted)),
    },
    {
      label: "Total Calls",
      current: currentCalls,
      previous: previousCalls,
      change: round(percentageChange(currentCalls, previousCalls), 1),
      trend: getTrend(percentageChange(currentCalls, previousCalls)),
    },
    {
      label: "Connected Calls",
      current: currentConnected,
      previous: previousConnected,
      change: round(percentageChange(currentConnected, previousConnected), 1),
      trend: getTrend(percentageChange(currentConnected, previousConnected)),
    },
  ];
}

/**
 * Get lead funnel with stage transitions and time metrics
 */
async function getFunnelAnalytics(
  leadFilter: Prisma.LeadWhereInput,
  from: Date,
  to: Date
): Promise<FunnelStageAdvanced[]> {
  const cohort: Prisma.LeadWhereInput = { AND: [leadFilter, { createdAt: { gte: from, lt: to } }] };

  const [created, contacted, connected, interested, qualified, converted] = await Promise.all([
    db.lead.count({ where: cohort }),
    db.lead.count({ where: { AND: [cohort, { calls: { some: {} } }] } }),
    db.lead.count({
      where: { AND: [cohort, { calls: { some: { disposition: { isConnected: true } } } }] },
    }),
    db.lead.count({
      where: {
        AND: [cohort, { calls: { some: { disposition: { key: "INTERESTED" } } } }],
      },
    }),
    db.lead.count({ where: { AND: [cohort, { status: "QUALIFIED" }] } }),
    db.lead.count({
      where: { AND: [cohort, { calls: { some: { disposition: { key: "CONVERTED" } } } }] },
    }),
  ]);

  const total = created || 1; // avoid division by zero

  return [
    {
      stage: "Created",
      count: created,
      percentage: 100,
      avgTimeInStage: null,
      conversionRate: round(conversionRate(contacted, created), 1),
    },
    {
      stage: "Contacted",
      count: contacted,
      percentage: round((contacted / total) * 100, 1),
      avgTimeInStage: null,
      conversionRate: round(conversionRate(connected, contacted), 1),
    },
    {
      stage: "Connected",
      count: connected,
      percentage: round((connected / total) * 100, 1),
      avgTimeInStage: null,
      conversionRate: round(conversionRate(interested, connected), 1),
    },
    {
      stage: "Interested",
      count: interested,
      percentage: round((interested / total) * 100, 1),
      avgTimeInStage: null,
      conversionRate: round(conversionRate(qualified, interested), 1),
    },
    {
      stage: "Qualified",
      count: qualified,
      percentage: round((qualified / total) * 100, 1),
      avgTimeInStage: null,
      conversionRate: round(conversionRate(converted, qualified), 1),
    },
    {
      stage: "Converted",
      count: converted,
      percentage: round((converted / total) * 100, 1),
      avgTimeInStage: null,
      conversionRate: null,
    },
  ];
}

/**
 * Get call patterns by hour of day
 */
async function getCallPatterns(
  callFilter: Prisma.CallLogWhereInput,
  from: Date,
  to: Date
): Promise<CallPatternData[]> {
  type HourRow = { hour: number; attempts: number; connected: number };

  const rows = await db.$queryRaw<HourRow[]>`
    SELECT 
      EXTRACT(HOUR FROM (c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::int as hour,
      COUNT(*)::int as attempts,
      COUNT(*) FILTER (WHERE d."isConnected")::int as connected
    FROM "CallLog" c
    LEFT JOIN "CallDisposition" d ON d.id = c."dispositionId"
    LEFT JOIN "Lead" l ON l.id = c."leadId"
    LEFT JOIN "User" a ON a.id = c."agentId"
    WHERE c."createdAt" >= ${from} AND c."createdAt" < ${to}
    GROUP BY hour
    ORDER BY hour
  `;

  return rows.map((row) => ({
    hour: row.hour,
    attempts: row.attempts,
    connected: row.connected,
    connectRate: round(conversionRate(row.connected, row.attempts), 1),
  }));
}

/**
 * Get cohort analysis (leads grouped by creation period)
 */
async function getCohortAnalytics(
  leadFilter: Prisma.LeadWhereInput,
  from: Date,
  to: Date
): Promise<CohortRow[]> {
  type CohortQueryRow = {
    cohort: string;
    totalLeads: number;
    converted: number;
    avgDaysToConvert: number | null;
  };

  const rows = await db.$queryRaw<CohortQueryRow[]>`
    SELECT 
      DATE_TRUNC('month', (l."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date::text as cohort,
      COUNT(*)::int as "totalLeads",
      COUNT(*) FILTER (WHERE EXISTS(
        SELECT 1 FROM "CallLog" c 
        JOIN "CallDisposition" d ON d.id = c."dispositionId" 
        WHERE c."leadId" = l.id AND d."key" = 'CONVERTED'
      ))::int as converted,
      AVG(
        EXTRACT(EPOCH FROM (
          (SELECT MIN(c2."createdAt") FROM "CallLog" c2 
           JOIN "CallDisposition" d2 ON d2.id = c2."dispositionId"
           WHERE c2."leadId" = l.id AND d2."key" = 'CONVERTED')
          - l."createdAt"
        )) / 86400
      ) as "avgDaysToConvert"
    FROM "Lead" l
    WHERE l."createdAt" >= ${from} AND l."createdAt" < ${to}
    GROUP BY cohort
    ORDER BY cohort DESC
    LIMIT 12
  `;

  const cohorts = rows.map((row) =>
    calculateCohortMetrics(
      formatCohortLabel(row.cohort),
      row.totalLeads,
      row.converted,
      row.avgDaysToConvert ? round(row.avgDaysToConvert, 1) : null
    )
  );

  return sortCohortsDesc(cohorts);
}

/**
 * Get channel/source performance
 */
async function getChannelPerformance(
  leadFilter: Prisma.LeadWhereInput,
  from: Date,
  to: Date
): Promise<ChannelPerformance[]> {
  type SourceRow = {
    name: string;
    leads: number;
    converted: number;
    avgDays: number | null;
  };

  const rows = await db.$queryRaw<SourceRow[]>`
    SELECT 
      s.name,
      COUNT(*)::int as leads,
      COUNT(*) FILTER (WHERE EXISTS(
        SELECT 1 FROM "CallLog" c 
        JOIN "CallDisposition" d ON d.id = c."dispositionId"
        WHERE c."leadId" = l.id AND d."key" = 'CONVERTED'
      ))::int as converted,
      AVG(
        EXTRACT(EPOCH FROM (
          (SELECT MIN(c2."createdAt") FROM "CallLog" c2 
           JOIN "CallDisposition" d2 ON d2.id = c2."dispositionId"
           WHERE c2."leadId" = l.id AND d2."key" = 'CONVERTED')
          - l."createdAt"
        )) / 86400
      ) as "avgDays"
    FROM "Lead" l
    JOIN "LeadSource" s ON s.id = l."sourceId"
    WHERE l."createdAt" >= ${from} AND l."createdAt" < ${to}
    GROUP BY s.name
    ORDER BY converted DESC
    LIMIT 10
  `;

  return rows.map((row) => ({
    name: row.name,
    leads: row.leads,
    converted: row.converted,
    conversionRate: round(conversionRate(row.converted, row.leads), 1),
    avgTimeToConvert: row.avgDays ? round(row.avgDays, 1) : null,
  }));
}

/**
 * Get top performing agents
 */
async function getTopAgents(
  scope: any,
  filters: AnalyticsFilters,
  from: Date,
  to: Date,
  limit: number
): Promise<AgentPerformance[]> {
  type AgentRow = {
    agentId: string;
    agentName: string;
    teamName: string | null;
    calls: number;
    connected: number;
    converted: number;
    avgDuration: number | null;
  };

  const rows = await db.$queryRaw<AgentRow[]>`
    SELECT 
      u.id as "agentId",
      u.name as "agentName",
      t.name as "teamName",
      COUNT(c.id)::int as calls,
      COUNT(*) FILTER (WHERE d."isConnected")::int as connected,
      COUNT(*) FILTER (WHERE d."key" = 'CONVERTED')::int as converted,
      AVG(c."durationSec") FILTER (WHERE d."isConnected") as "avgDuration"
    FROM "User" u
    LEFT JOIN "Team" t ON t.id = u."teamId"
    LEFT JOIN "CallLog" c ON c."agentId" = u.id 
      AND c."createdAt" >= ${from} 
      AND c."createdAt" < ${to}
    LEFT JOIN "CallDisposition" d ON d.id = c."dispositionId"
    WHERE u."status" = 'ACTIVE'
      ${filters.teamId ? Prisma.sql`AND u."teamId" = ${filters.teamId}` : Prisma.empty}
    GROUP BY u.id, u.name, t.name
    HAVING COUNT(c.id) > 0
    ORDER BY converted DESC, connected DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    agentId: row.agentId,
    agentName: row.agentName,
    teamName: row.teamName || "No Team",
    calls: row.calls,
    connected: row.connected,
    converted: row.converted,
    avgCallDuration: row.avgDuration ? round(row.avgDuration, 0) : 0,
    connectRate: round(conversionRate(row.connected, row.calls), 1),
    conversionRate: round(conversionRate(row.converted, row.calls), 1),
  }));
}

/**
 * Get trend data for charts
 */
async function getTrendData(
  leadFilter: Prisma.LeadWhereInput,
  callFilter: Prisma.CallLogWhereInput,
  from: Date,
  to: Date
) {
  type DailyRow = {
    day: string;
    leads: number;
    calls: number;
    conversions: number;
  };

  const rows = await db.$queryRaw<DailyRow[]>`
    SELECT 
      to_char(d::date, 'YYYY-MM-DD') as day,
      COALESCE((
        SELECT COUNT(*)::int 
        FROM "Lead" l 
        WHERE DATE(l."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = d::date
      ), 0) as leads,
      COALESCE((
        SELECT COUNT(*)::int 
        FROM "CallLog" c 
        WHERE DATE(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = d::date
      ), 0) as calls,
      COALESCE((
        SELECT COUNT(*)::int 
        FROM "CallLog" c 
        JOIN "CallDisposition" disp ON disp.id = c."dispositionId"
        WHERE DATE(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = d::date
          AND disp."key" = 'CONVERTED'
      ), 0) as conversions
    FROM generate_series(
      ${from}::timestamp,
      ${to}::timestamp - interval '1 day',
      interval '1 day'
    ) d
    ORDER BY day
  `;

  const leadsData = rows.map((r) => ({ date: r.day, value: r.leads }));
  const callsData = rows.map((r) => ({ date: r.day, value: r.calls }));
  const conversionsData = rows.map((r) => ({ date: r.day, value: r.conversions }));

  return {
    leads: movingAverage(leadsData, 7), // 7-day moving average
    calls: movingAverage(callsData, 7),
    conversions: movingAverage(conversionsData, 7),
  };
}
