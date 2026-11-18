import { route } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/session";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { AppError } from "@/lib/errors";
import { isReportKey } from "@/lib/reports/definitions";
import { exportReport } from "@/services/report-service";

export const dynamic = "force-dynamic";

export const GET = route<{ params: { type: string } }>(async (req, { params }) => {
  const user = await requireApiPermission("report", "EXPORT");
  if (!isReportKey(params.type)) throw new AppError("NOT_FOUND", "Unknown report");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const format = q.format === "xlsx" ? "xlsx" : q.format === "pdf" ? "pdf" : "csv";
  const group = q.group === "week" ? "week" : q.group === "month" ? "month" : "day";
  const out = await exportReport(user, params.type, parseDashboardFilters(q), group, format);
  return new Response(new Uint8Array(out.body), { headers: { "Content-Type": out.contentType, "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "no-store" } });
});
