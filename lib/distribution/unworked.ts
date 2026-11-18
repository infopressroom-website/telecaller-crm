import type { Prisma } from "@prisma/client";

/**
 * "Unworked" = owned, still in the Assigned status, no call logged, and no assignment event since the cutoff
 * (i.e. it has been sitting with the same person untouched for longer than the allowed time).
 */
export function unworkedClause(cutoff: Date): Prisma.LeadWhereInput {
  return {
    ownerId: { not: null },
    status: "ASSIGNED",
    calls: { none: {} },
    assignments: { none: { createdAt: { gte: cutoff } } },
  };
}
