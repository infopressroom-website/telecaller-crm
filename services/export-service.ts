import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { escapeCsvCell } from "@/lib/leads/csv-safe";
import { LEAD_ORDER, buildLeadWhere } from "@/lib/leads/query";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/leads/fields";
import type { LeadListQuery } from "@/validations/lead";
import { audit } from "./audit-service";
import { resolveScope } from "./scope-service";
import { getDistributionSettings } from "./settings-service";

export const EXPORT_LIMIT = 50_000;
const HEADER = ["Lead ID", "Name", "Primary mobile", "Alternate mobile", "Email", "City", "State", "Source", "Campaign", "Status", "Priority", "Assigned to", "Team", "Next follow-up", "Created", "Notes"];

/** Exports exactly what the list shows for these filters, limited to the user's own scope. */
export async function exportLeads(user: AuthUser, q: LeadListQuery, format: "csv" | "xlsx") {
  assertCan(user, "lead", "EXPORT");
  const scope = await resolveScope(user);
  const { unworkedAfterHours } = await getDistributionSettings();
  const leads = await db.lead.findMany({
    where: buildLeadWhere(scope, q, new Date(), new Date(Date.now() - unworkedAfterHours * 3_600_000)), orderBy: LEAD_ORDER[q.sort], take: EXPORT_LIMIT,
    include: { owner: { select: { name: true } }, team: { select: { name: true } }, source: { select: { name: true } }, campaign: { select: { name: true } } },
  });
  const rows = leads.map((l) => [
    l.leadCode, l.name, l.primaryMobile, l.alternateMobile, l.email, l.city, l.state, l.source?.name, l.campaign?.name,
    STATUS_LABELS[l.status], PRIORITY_LABELS[l.priority], l.owner?.name, l.team?.name,
    l.nextFollowUpAt?.toISOString().slice(0, 10), l.createdAt.toISOString().slice(0, 10), l.notes,
  ]);
  await audit({ actorId: user.id, action: "lead.export", entityType: "Lead", after: { count: rows.length, format, filters: JSON.parse(JSON.stringify(q)) } });

  if (format === "csv") {
    const csv = Papa.unparse([HEADER, ...rows.map((r) => r.map(escapeCsvCell))]);
    return { body: Buffer.from("\uFEFF" + csv, "utf8"), contentType: "text/csv; charset=utf-8", ext: "csv", truncated: leads.length === EXPORT_LIMIT };
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");
  ws.addRow(HEADER).font = { bold: true };
  for (const r of rows) ws.addRow(r.map((c) => c ?? ""));
  ws.columns.forEach((c) => { c.width = 18; });
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return { body: buf, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", truncated: leads.length === EXPORT_LIMIT };
}
