import { route } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/session";
import { parseLeadListQuery } from "@/validations/lead";
import { exportLeads } from "@/services/export-service";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const user = await requireApiPermission("lead", "EXPORT");
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);
  const format = params.format === "xlsx" ? "xlsx" : "csv";
  const out = await exportLeads(user, parseLeadListQuery(params), format);
  return new Response(new Uint8Array(out.body), {
    headers: {
      "Content-Type": out.contentType,
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.${out.ext}"`,
      "Cache-Control": "no-store",
      ...(out.truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
});
