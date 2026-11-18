import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { percent } from "@/lib/dashboard-series";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { dayKeyIST } from "@/lib/date-range";
import { workedMinutes } from "@/lib/attendance/calc";
import { escapeCsvCell } from "@/lib/leads/csv-safe";
import { REPORTS, type ReportKey, type ReportTable } from "@/lib/reports/definitions";
import { groupSeries, type Grouping } from "@/lib/reports/group";
import { tableToPdf } from "@/lib/reports/pdf";
import { audit } from "./audit-service";
import { monthlyReport } from "./attendance-service";
import { getDashboardData } from "./dashboard-service";
import { getAgentStats } from "./performance-service";
import { cacheGet, cacheSet } from "@/lib/redis";

const T = (title: string, f: DashboardFilters, columns: [string, string][], rows: ReportTable["rows"]): ReportTable => ({
  title, subtitle: `${f.range.label} · India time · generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, columns: columns.map(([key, label]) => ({ key, label })), rows,
});

function hashFilters(f: DashboardFilters, group: Grouping): string {
  const data = JSON.stringify({ from: f.range.from.getTime(), to: f.range.to.getTime(), teamId: f.teamId, campaignId: f.campaignId, group });
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

export async function buildReport(user: AuthUser, key: ReportKey, f: DashboardFilters, group: Grouping = "day"): Promise<ReportTable> {
  assertCan(user, "report", "VIEW");
  const def = REPORTS.find((r) => r.key === key)!;
  for (const [res, act] of def.needs) assertCan(user, res, act as "VIEW");
  
  // Try cache first (5 minutes TTL)
  const cacheKey = `report:${key}:${user.id}:${hashFilters(f, group)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as ReportTable;
    } catch {
      // Invalid cache, continue to regenerate
    }
  }

  let result: ReportTable;
  
  switch (key) {
    case "calling": {
      const d = await getDashboardData(user, f);
      result = T(`Calling activity (${group})`, f, [["period", "Period"], ["attempts", "Call attempts"], ["connected", "Connected"], ["rate", "Connect rate %"]], groupSeries(d.daily, group).map((p) => ({ period: p.label, attempts: p.attempts, connected: p.connected, rate: percent(p.connected, p.attempts) })));
      break;
    }
    case "performance": {
      const { rows } = await getAgentStats(user, f);
      result = T("Telecaller performance", f, [["name", "Telecaller"], ["team", "Team"], ["attempts", "Calls"], ["connected", "Connected"], ["connectRate", "Connect rate %"], ["interested", "Interested"], ["followUps", "Follow-ups done"], ["conversions", "Conversions"], ["conversionRate", "Conversion rate %"], ["avgTalkSec", "Avg talk (s)"], ["qaScore", "QA score"]],
        rows.map((r) => ({ name: r.name, team: r.team, attempts: r.attempts, connected: r.connected, connectRate: r.connectRate, interested: r.interested, followUps: r.followUps, conversions: r.conversions, conversionRate: r.conversionRate, avgTalkSec: r.avgTalkSec, qaScore: r.qaScore })));
      break;
    }
    case "teams": {
      const d = await getDashboardData(user, f);
      result = T("Team comparison", f, [["name", "Team"], ["attempts", "Call attempts"], ["connected", "Connected"], ["rate", "Connect rate %"], ["conversions", "Conversions"]], d.teams.map((t) => ({ name: t.name, attempts: t.attempts, connected: t.connected, rate: percent(t.connected, t.attempts), conversions: t.conversions })));
      break;
    }
    case "sources":
    case "campaigns": {
      const d = await getDashboardData(user, f);
      const rows = key === "sources" ? d.sources : d.campaigns;
      result = T(key === "sources" ? "Lead source performance" : "Campaign conversion", f, [["name", key === "sources" ? "Source" : "Campaign"], ["leads", "Leads created"], ["converted", "Converted"], ["rate", "Conversion rate %"]], rows.map((r) => ({ name: r.name, leads: r.leads, converted: r.converted, rate: r.conversionRate })));
      break;
    }
    case "funnel": {
      const d = await getDashboardData(user, f);
      const base = d.funnel[0]?.count ?? 0;
      result = T("Conversion funnel", f, [["stage", "Stage"], ["count", "Leads"], ["pct", "% of created"]], d.funnel.map((s) => ({ stage: s.stage, count: s.count, pct: percent(s.count, base) })));
      break;
    }
    case "followups": {
      const { followUps: x } = await getDashboardData(user, f);
      result = T("Follow-up completion", f, [["status", "Status"], ["count", "Follow-ups"]], [
        { status: "Completed", count: x.completed }, { status: "Missed", count: x.missed }, { status: "Overdue (still pending)", count: x.overduePending },
        { status: "Upcoming (pending)", count: x.upcomingPending }, { status: "Rescheduled", count: x.rescheduled }, { status: "Completion rate %", count: x.completionRate },
      ]);
      break;
    }
    case "attendance": {
      const month = dayKeyIST(f.range.from).slice(0, 7);
      const rows = await monthlyReport(user, month);
      result = { title: `Attendance ${month}`, subtitle: `Month of the start date · generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, columns: ["name", "present", "halfDay", "absent", "leave", "late", "hours"].map((k, i) => ({ key: k, label: ["Employee", "Present", "Half day", "Absent", "Leave", "Late", "Hours worked"][i]! })),
        rows: rows.map((r) => ({ name: r.name, present: r.present, halfDay: r.halfDay, absent: r.absent, leave: r.leave, late: r.late, hours: Math.round((r.workedMin / 60) * 10) / 10 })) };
      break;
    }
    case "productivity": {
      const { rows } = await getAgentStats(user, f);
      const ids = rows.map((r) => r.id);
      const att = await db.attendance.findMany({ where: { userId: { in: ids }, date: { gte: new Date(`${dayKeyIST(f.range.from)}T00:00:00Z`), lt: new Date(`${dayKeyIST(new Date(f.range.to.getTime() - 1))}T23:59:59Z`) }, clockOutAt: { not: null } }, include: { breaks: true } });
      const now = new Date();
      const minutes = new Map<string, number>();
      for (const a of att) minutes.set(a.userId, (minutes.get(a.userId) ?? 0) + workedMinutes(a.clockInAt, a.clockOutAt, a.breaks, now));
      result = T("Productivity", f, [["name", "Telecaller"], ["hours", "Hours worked"], ["attempts", "Calls"], ["connected", "Connected"], ["perHour", "Calls per hour worked"], ["avgTalk", "Avg talk (s)"]],
        rows.map((r) => { const h = (minutes.get(r.id) ?? 0) / 60; return { name: r.name, hours: Math.round(h * 10) / 10, attempts: r.attempts, connected: r.connected, perHour: h > 0 ? Math.round((r.attempts / h) * 10) / 10 : null, avgTalk: r.avgTalkSec }; }));
      break;
    }
    case "qa": {
      const { rows } = await getAgentStats(user, f);
      const g = await db.qaReview.groupBy({ by: ["agentId"], where: { agentId: { in: rows.map((r) => r.id) }, createdAt: { gte: f.range.from, lt: f.range.to }, score: { not: null } }, _avg: { score: true }, _min: { score: true }, _max: { score: true }, _count: { _all: true } });
      const by = new Map(g.map((x) => [x.agentId, x]));
      result = T("QA scores", f, [["name", "Telecaller"], ["reviews", "Reviews"], ["avg", "Average score %"], ["min", "Lowest"], ["max", "Highest"]],
        rows.map((r) => { const x = by.get(r.id); return { name: r.name, reviews: x?._count._all ?? 0, avg: x?._avg.score ? Math.round(x._avg.score * 10) / 10 : null, min: x?._min.score ?? null, max: x?._max.score ?? null }; }));
      break;
    }
  }
  
  // Cache result for 5 minutes (300 seconds)
  await cacheSet(cacheKey, JSON.stringify(result), 300);
  
  return result;
}

export async function exportReport(user: AuthUser, key: ReportKey, f: DashboardFilters, group: Grouping, format: "csv" | "xlsx" | "pdf") {
  assertCan(user, "report", "EXPORT");
  const t = await buildReport(user, key, f, group);
  await audit({ actorId: user.id, action: "report.export", entityType: "Report", entityId: key, after: { format, range: f.range.label, rows: t.rows.length } });
  const name = `${key}-${dayKeyIST(new Date())}`;
  if (format === "csv") {
    const csv = Papa.unparse([t.columns.map((c) => c.label), ...t.rows.map((r) => t.columns.map((c) => escapeCsvCell(r[c.key])))]);
    return { body: Buffer.from("\uFEFF" + csv, "utf8"), contentType: "text/csv; charset=utf-8", filename: `${name}.csv` };
  }
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t.title.slice(0, 30));
    ws.addRow(t.columns.map((c) => c.label)).font = { bold: true };
    for (const r of t.rows) ws.addRow(t.columns.map((c) => r[c.key] ?? ""));
    ws.columns.forEach((c) => { c.width = 20; });
    return { body: Buffer.from(await wb.xlsx.writeBuffer()), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `${name}.xlsx` };
  }
  return { body: Buffer.from(await tableToPdf(t)), contentType: "application/pdf", filename: `${name}.pdf` };
}
