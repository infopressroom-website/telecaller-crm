import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/session";
import { parseAnalyticsFilters } from "@/lib/analytics-filters";
import { getAnalyticsData } from "@/services/analytics-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiPermission("analytics", "EXPORT");
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const format = searchParams.format || "csv";

    const filters = parseAnalyticsFilters(searchParams);
    const analytics = await getAnalyticsData(user, filters);

    if (format === "csv") {
      // Generate CSV
      let csv = "Telecaller CRM - Analytics Report\n";
      csv += `Period: ${filters.range.label}\n`;
      csv += `Generated: ${new Date().toISOString()}\n\n`;

      // Overview metrics
      csv += "OVERVIEW METRICS\n";
      csv += "Metric,Value\n";
      csv += `Total Leads,${analytics.overview.totalLeads}\n`;
      csv += `Conversion Rate,${analytics.overview.conversionRate}%\n`;
      csv += `Calls Today,${analytics.overview.callsToday}\n`;
      csv += `Active Follow-ups,${analytics.overview.activeFollowUps}\n\n`;

      // KPI Comparisons
      csv += "PERIOD COMPARISON\n";
      csv += "KPI,Current,Previous,Change %,Trend\n";
      analytics.comparisons.forEach((comp) => {
        csv += `${comp.label},${comp.current},${comp.previous},${comp.change},${comp.trend}\n`;
      });
      csv += "\n";

      // Funnel
      csv += "CONVERSION FUNNEL\n";
      csv += "Stage,Count,Percentage,Conversion to Next\n";
      analytics.funnel.forEach((stage) => {
        csv += `${stage.stage},${stage.count},${stage.percentage}%,${stage.conversionRate !== null ? stage.conversionRate + "%" : "N/A"}\n`;
      });
      csv += "\n";

      // Channel performance
      csv += "CHANNEL PERFORMANCE\n";
      csv += "Channel,Leads,Converted,Conversion Rate,Avg Days to Convert\n";
      analytics.channels.forEach((ch) => {
        csv += `${ch.name},${ch.leads},${ch.converted},${ch.conversionRate}%,${ch.avgTimeToConvert || "N/A"}\n`;
      });
      csv += "\n";

      // Top agents
      csv += "TOP PERFORMING AGENTS\n";
      csv += "Agent,Team,Calls,Connected,Converted,Connect Rate,Conversion Rate,Avg Duration\n";
      analytics.topAgents.forEach((agent) => {
        csv += `${agent.agentName},${agent.teamName},${agent.calls},${agent.connected},${agent.converted},${agent.connectRate}%,${agent.conversionRate}%,${agent.avgCallDuration}s\n`;
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="analytics-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else if (format === "xlsx") {
      // For Excel export, we'll need to use a library like exceljs
      // For now, return CSV with xlsx extension
      return new NextResponse("Excel export not yet implemented. Please use CSV format.", {
        status: 501,
      });
    } else {
      return NextResponse.json({ error: "Invalid format. Use 'csv' or 'xlsx'." }, { status: 400 });
    }
  } catch (error) {
    console.error("Analytics export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
