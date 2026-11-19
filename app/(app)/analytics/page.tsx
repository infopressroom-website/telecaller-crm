import { requirePagePermission } from "@/lib/auth/session";
import { parseAnalyticsFilters } from "@/lib/analytics-filters";
import { getAnalyticsData } from "@/services/analytics-service";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyticsFilterBar } from "@/features/analytics/filters/filter-bar";
import { KPIComparisonGrid } from "@/features/analytics/widgets/kpi-comparison";
import { MetricCard } from "@/features/analytics/widgets/metric-card";
import { TrendChart } from "@/features/analytics/charts/trend-chart";
import { HeatmapChart } from "@/features/analytics/charts/heatmap-chart";
import { FunnelChartAdvanced } from "@/features/analytics/charts/funnel-chart-advanced";
import { DataTable } from "@/features/analytics/tables/data-table";
import { ExportButton } from "@/features/analytics/tables/export-button";
import { TrendingUp, Users, PhoneCall, Calendar, BarChart3 } from "lucide-react";
import { COLORS } from "@/features/analytics/charts/trend-chart";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const user = await requirePagePermission("analytics", "VIEW");
  const filters = parseAnalyticsFilters(searchParams);

  // Fetch analytics data
  const analytics = await getAnalyticsData(user, filters);

  // Fetch filter options
  const [teams, campaigns, sources] = await Promise.all([
    db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.leadSource.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const canExport = user.permissions.has("analytics:EXPORT");

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Advanced Analytics"
        description={`Showing: ${filters.range.label} (IST)`}
        actions={
          canExport && (
            <ExportButton
              filters={{
                preset: filters.range.preset,
                from: filters.range.from.toISOString().split("T")[0],
                to: filters.range.to.toISOString().split("T")[0],
                teamId: filters.teamId,
                campaignId: filters.campaignId,
                sourceId: filters.sourceId,
              }}
            />
          )
        }
      />

      {/* Filters */}
      <AnalyticsFilterBar filters={filters} teams={teams} campaigns={campaigns} sources={sources} />

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Leads"
          value={analytics.overview.totalLeads}
          icon={Users}
          subtitle="In selected period"
        />
        <MetricCard
          label="Conversion Rate"
          value={`${analytics.overview.conversionRate}%`}
          icon={TrendingUp}
          subtitle="Leads to conversions"
        />
        <MetricCard
          label="Calls Today"
          value={analytics.overview.callsToday}
          icon={PhoneCall}
          subtitle="All call attempts"
        />
        <MetricCard
          label="Active Follow-ups"
          value={analytics.overview.activeFollowUps}
          icon={Calendar}
          subtitle="Pending or overdue"
        />
      </div>

      {/* KPI Comparisons */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Period Comparison</h2>
        <KPIComparisonGrid comparisons={analytics.comparisons} />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Lead Trends</h3>
          <TrendChart
            data={analytics.trends.leads}
            series={[
              { key: "value", label: "Leads", color: COLORS.primary },
            ]}
            label="Daily lead creation trend"
            showMovingAvg
          />
        </div>

        <div className="rounded-card border border-line bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Call & Conversion Trends</h3>
          <TrendChart
            data={analytics.trends.calls}
            series={[
              { key: "value", label: "Calls", color: COLORS.secondary },
            ]}
            label="Daily call volume trend"
            showMovingAvg
          />
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Conversion Funnel Analysis</h2>
        <FunnelChartAdvanced data={analytics.funnel} />
      </div>

      {/* Call Patterns Heatmap */}
      <div className="rounded-card border border-line bg-white p-5">
        <HeatmapChart data={analytics.callPatterns} title="Call Activity by Hour of Day" />
      </div>

      {/* Channel Performance */}
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Channel Performance</h2>
        <DataTable
          data={analytics.channels}
          columns={[
            { key: "name", label: "Channel/Source", align: "left" },
            { key: "leads", label: "Leads", align: "right", format: (v) => v.toLocaleString() },
            { key: "converted", label: "Converted", align: "right", format: (v) => v.toLocaleString() },
            { key: "conversionRate", label: "Conversion Rate", align: "right", format: (v) => `${v}%` },
            {
              key: "avgTimeToConvert",
              label: "Avg. Days to Convert",
              align: "right",
              format: (v) => (v !== null ? `${v} days` : "—"),
            },
          ]}
          emptyMessage="No channel data available for the selected period"
        />
      </div>

      {/* Cohort Analysis */}
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Cohort Analysis</h2>
        <DataTable
          data={analytics.cohorts}
          columns={[
            { key: "cohort", label: "Cohort Period", align: "left" },
            { key: "totalLeads", label: "Total Leads", align: "right", format: (v) => v.toLocaleString() },
            { key: "converted", label: "Converted", align: "right", format: (v) => v.toLocaleString() },
            { key: "conversionRate", label: "Conversion Rate", align: "right", format: (v) => `${v}%` },
            {
              key: "avgDaysToConvert",
              label: "Avg. Days to Convert",
              align: "right",
              format: (v) => (v !== null ? `${v} days` : "—"),
            },
          ]}
          emptyMessage="No cohort data available for the selected period"
        />
      </div>

      {/* Top Performers */}
      <div className="rounded-card border border-line bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Top Performing Agents</h2>
        <DataTable
          data={analytics.topAgents}
          columns={[
            { key: "agentName", label: "Agent", align: "left" },
            { key: "teamName", label: "Team", align: "left" },
            { key: "calls", label: "Calls", align: "right", format: (v) => v.toLocaleString() },
            { key: "connected", label: "Connected", align: "right", format: (v) => v.toLocaleString() },
            { key: "converted", label: "Converted", align: "right", format: (v) => v.toLocaleString() },
            { key: "connectRate", label: "Connect Rate", align: "right", format: (v) => `${v}%` },
            { key: "conversionRate", label: "Conversion Rate", align: "right", format: (v) => `${v}%` },
            {
              key: "avgCallDuration",
              label: "Avg. Duration (sec)",
              align: "right",
              format: (v) => v.toLocaleString(),
            },
          ]}
          emptyMessage="No agent performance data available for the selected period"
        />
      </div>
    </div>
  );
}
