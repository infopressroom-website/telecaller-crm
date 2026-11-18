import type { Prisma } from "@prisma/client";
import { leadWhere, type DataScope } from "@/lib/auth/scope";
import { addDays, startOfDayIST } from "@/lib/date-range";
import { unworkedClause } from "@/lib/distribution/unworked";
import type { LeadListQuery } from "@/validations/lead";

const istDay = (s: string) => new Date(`${s}T00:00:00+05:30`);

/** Role scope first; user filters only ever narrow it. */
export function buildLeadWhere(scope: DataScope, q: LeadListQuery, now = new Date(), unworkedCutoff?: Date): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [leadWhere(scope)];

  if (q.q) {
    const or: Prisma.LeadWhereInput[] = [
      { name: { contains: q.q, mode: "insensitive" } },
      { leadCode: { contains: q.q, mode: "insensitive" } },
    ];
    const digits = q.q.replace(/\D/g, "");
    if (digits.length >= 4) or.push({ primaryMobile: { contains: digits } }, { alternateMobile: { contains: digits } });
    and.push({ OR: or });
  }
  if (q.status) and.push({ status: q.status });
  if (q.priority) and.push({ priority: q.priority });
  if (q.sourceId) and.push({ sourceId: q.sourceId });
  if (q.campaignId) and.push({ campaignId: q.campaignId });
  if (q.teamId) and.push({ teamId: q.teamId });
  if (q.ownerId) and.push(q.ownerId === "unassigned" ? { ownerId: null } : { ownerId: q.ownerId });
  if (q.createdFrom) and.push({ createdAt: { gte: istDay(q.createdFrom) } });
  if (q.createdTo) and.push({ createdAt: { lt: addDays(istDay(q.createdTo), 1) } });
  if (q.work === "unworked" && unworkedCutoff) and.push(unworkedClause(unworkedCutoff));
  if (q.followUp === "overdue") and.push({ nextFollowUpAt: { lt: now } });
  if (q.followUp === "today") {
    const start = startOfDayIST(now);
    and.push({ nextFollowUpAt: { gte: start, lt: addDays(start, 1) } });
  }
  return { AND: and };
}

export const LEAD_ORDER: Record<LeadListQuery["sort"], Prisma.LeadOrderByWithRelationInput[]> = {
  created_desc: [{ createdAt: "desc" }],
  created_asc: [{ createdAt: "asc" }],
  name_asc: [{ name: "asc" }, { createdAt: "desc" }],
  followup_asc: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  updated_desc: [{ updatedAt: "desc" }],
};
