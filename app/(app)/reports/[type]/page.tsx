import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/features/dashboard/filter-bar";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { REPORTS, isReportKey } from "@/lib/reports/definitions";
import { buildReport } from "@/services/report-service";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: { params: { type: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requirePagePermission("report", "VIEW");
  if (!isReportKey(params.type)) notFound();
  const def = REPORTS.find((r) => r.key === params.type)!;
  const filters = parseDashboardFilters(searchParams);
  const group = searchParams.group === "week" ? "week" : searchParams.group === "month" ? "month" : "day";
  let table;
  try { table = await buildReport(user, params.type, filters, group); } catch (e) { if (e instanceof AppError && e.code === "FORBIDDEN") notFound(); throw e; }
  const [teams, campaigns] = await Promise.all([db.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.campaign.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const qs = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const exp = (f: string) => `/api/reports/${def.key}/export?format=${f}${qs ? `&${qs}` : ""}`;
  return (
    <>
      <PageHeader title={def.title} description={def.description} actions={can(user, "report", "EXPORT") && <>{["csv", "xlsx", "pdf"].map((f) => <a key={f} href={exp(f)} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold uppercase">{f}</a>)}</>} />
      <FilterBar filters={filters} options={{ teams, campaigns }} action={`/reports/${def.key}`}>
        {def.grouped && <label className="flex flex-col gap-1 text-sm font-medium">Group by<select name="group" defaultValue={group} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>}
      </FilterBar>
      {filters.notice && <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{filters.notice}</p>}
      <Card>
        <p className="mb-2 text-xs text-ink-muted">{table.subtitle}</p>
        {table.rows.length === 0 ? <EmptyState title="No data for this period" description="Try a wider period or different filters." /> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-ink-muted">{table.columns.map((c) => <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{c.label}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i} className="border-b border-slate-100">{table.columns.map((c) => <td key={c.key} className="px-3 py-2">{r[c.key] ?? "—"}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <Link href="/reports" className="text-sm text-brand-700 underline">All reports</Link>
    </>
  );
}
