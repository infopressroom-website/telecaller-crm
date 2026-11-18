/**
 * Auto-trigger lead score calculation
 * Call this after lead updates or call log creation
 */

import { calculateLeadScore } from "./lead-scoring";
import { db } from "./db";

/**
 * Recalculate and save lead score
 * Safe to call multiple times - idempotent
 */
export async function updateLeadScore(leadId: string): Promise<number> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      callLogs: {
        orderBy: { createdAt: "desc" },
        take: 20, // Last 20 calls for scoring
      },
      followUps: {
        where: {
          status: "PENDING",
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      },
    },
  });

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // Calculate new score
  const score = calculateLeadScore(lead);

  // Save to database
  await db.lead.update({
    where: { id: leadId },
    data: { score },
  });

  return score;
}

/**
 * Bulk recalculate scores for multiple leads
 * Useful for batch updates or migrations
 */
export async function updateLeadScoresBulk(leadIds: string[]): Promise<void> {
  await Promise.all(leadIds.map((id) => updateLeadScore(id).catch(console.error)));
}
