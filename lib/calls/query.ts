import type { Prisma } from "@prisma/client";
import { callScopeWhere, type DataScope } from "@/lib/auth/scope";
import { addDays } from "@/lib/date-range";
import type { CallListQuery } from "@/validations/calls";

const istDay = (s: string) => new Date(`${s}T00:00:00+05:30`);

/** Role scope first; filters only narrow it. Dates are India calendar days, end date inclusive. */
export function buildCallWhere(scope: DataScope, q: CallListQuery): Prisma.CallLogWhereInput {
  const and: Prisma.CallLogWhereInput[] = [callScopeWhere(scope)];
  if (q.q) {
    const digits = q.q.replace(/\D/g, "");
    const or: Prisma.LeadWhereInput[] = [{ name: { contains: q.q, mode: "insensitive" } }, { leadCode: { contains: q.q, mode: "insensitive" } }];
    if (digits.length >= 4) or.push({ primaryMobile: { contains: digits } }, { alternateMobile: { contains: digits } });
    and.push({ lead: { OR: or } });
  }
  if (q.agentId) and.push({ agentId: q.agentId });
  if (q.teamId) and.push({ agent: { teamId: q.teamId } });
  if (q.disposition) and.push({ disposition: { key: q.disposition } });
  if (q.direction) and.push({ direction: q.direction });
  if (q.status) and.push({ status: q.status });
  if (q.from) and.push({ createdAt: { gte: istDay(q.from) } });
  if (q.to) and.push({ createdAt: { lt: addDays(istDay(q.to), 1) } });
  return { AND: and };
}
