import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { COLORS, DailyActivityChart, FunnelChart, GroupedBarChart } from "@/features/dashboard/charts";
import { FilterBar } from "@/features/dashboard/filter-bar";
import { KpiGrid } from "@/features/dashboard/kpi-grid";
import { RecentActivity } from "@/features/dashboard/recent-activity";
import { requirePagePermission } from "@/lib/auth/session";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { METRIC_DEFINITIONS } from "@/lib/metrics-definitions";
import { getDashboardData, getFilterOptions } from "@/services/dashboard-service";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function ChartCard({ title, note, hasData, empty, children }: { title: string; note?: string; hasData: boolean; empty: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-ink-muted">{note}</p>}
      {hasData ? children : <EmptyState icon={BarChart3} title={empty} description="Try a wider period or different filters." />}
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requirePagePermission("dashboard", "VIEW");
  const filters = parseDashboardFilters(searchParams);
  const [data, options] = await Promise.all([getDashboardData(user, filters), getFilterOptions(user)]);
  const { followUps: fu } = data;

  return (
    <>
      <PageHeader title="Command centre" description={`Showing: ${filters.range.label} (IST)`} />
      <FilterBar filters={filters} options={options} />
      {filters.notice && <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{filters.notice}</p>}

      <KpiGrid kpis={data.kpis} />

      <section aria-label="Charts" className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Daily calling activity" note={data.daily.length > 0 && filters.range.to.getTime() - filters.range.from.getTime() > 62 * 86_400_000 ? "Shown in 7-day buckets" : undefined} hasData={data.daily.some((d) => d.attempts > 0)} empty="No calls in this period">
          <DailyActivityChart data={data.daily} />
        </ChartCard>
        <ChartCard title="Lead conversion funnel" note="Leads created in the period and how far they progressed" hasData={data.funnel.some((s) => s.count > 0)} empty="No leads created in this period">
          <FunnelChart data={data.funnel} />
        </ChartCard>
        <ChartCard title="Lead-source performance" note="Leads created in the period, and how many were converted" hasData={data.sources.length > 0} empty="No leads in this period">
          <GroupedBarChart label="Bar chart of leads and conversions by lead source" data={data.sources} series={[{ key: "leads", label: "Leads", color: COLORS.primary }, { key: "converted", label: "Converted", color: COLORS.secondary }]} />
        </ChartCard>
        <ChartCard title="Campaign conversion" hasData={data.campaigns.length > 0} empty="No campaign leads in this period">
          <GroupedBarChart label="Bar chart of leads and conversions by campaign" data={data.campaigns} series={[{ key: "leads", label: "Leads", color: COLORS.primary }, { key: "converted", label: "Converted", color: COLORS.secondary }]} />
        </ChartCard>
        <ChartCard title="Telecaller comparison" note="Top 10, ranked by conversions, then connected calls" hasData={data.agents.length > 0} empty="No calls in this period">
          <GroupedBarChart label="Bar chart comparing telecallers by attempts, connected calls and conversions" data={data.agents} series={[{ key: "attempts", label: "Attempts", color: COLORS.primary }, { key: "connected", label: "Connected", color: COLORS.secondary }, { key: "conversions", label: "Conversions", color: COLORS.tertiary }]} />
        </ChartCard>
        <ChartCard title="Team productivity" hasData={data.teams.length > 0} empty="No team activity in this period">
          <GroupedBarChart label="Bar chart comparing teams by attempts, connected calls and conversions" data={data.teams} series={[{ key: "attempts", label: "Attempts", color: COLORS.primary }, { key: "connected", label: "Connected", color: COLORS.secondary }, { key: "conversions", label: "Conversions", color: COLORS.tertiary }]} />
        </ChartCard>
        <ChartCard
          title="Follow-up completion"
          note={fu.completionRate === null ? "Follow-ups due in the period" : `Completion rate ${fu.completionRate}% (completed ÷ completed + missed + overdue)`}
          hasData={fu.completed + fu.missed + fu.overduePending + fu.upcomingPending + fu.rescheduled > 0}
          empty="No follow-ups due in this period"
        >
          <GroupedBarChart
            label="Bar chart of follow-ups by status"
            data={[
              { name: "Completed", value: fu.completed },
              { name: "Missed", value: fu.missed },
              { name: "Overdue", value: fu.overduePending },
              { name: "Upcoming", value: fu.upcomingPending },
              { name: "Rescheduled", value: fu.rescheduled },
            ]}
            series={[{ key: "value", label: "Follow-ups", color: COLORS.primary }]}
          />
        </ChartCard>
      </section>

      <RecentActivity recent={data.recent} />

      <details className="rounded-card border border-line bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">How these numbers are calculated</summary>
        <dl className="mt-3 grid gap-3">
          {METRIC_DEFINITIONS.map((m) => (
            <div key={m.label}>
              <dt className="font-medium">{m.label} <span className="text-xs font-normal text-ink-muted">({m.basis === "period" ? "in period" : "snapshot"})</span></dt>
              <dd className="text-ink-muted">{m.definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
