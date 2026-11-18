import { route } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/session";
import { failedRowsCsv } from "@/services/import-service";

export const dynamic = "force-dynamic";

export const GET = route<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireApiPermission("lead", "CREATE");
  const csv = await failedRowsCsv(user, params.id);
  return new Response("\uFEFF" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="import-report.csv"', "Cache-Control": "no-store" },
  });
});
