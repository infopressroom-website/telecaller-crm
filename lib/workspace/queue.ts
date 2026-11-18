import { PRIORITY_WEIGHT, type PriorityKey } from "@/lib/distribution/engine";

export type QueueLead = {
  id: string; name: string; status: string; priority: PriorityKey;
  nextFollowUpAt: Date | null; lastContactedAt: Date | null; createdAt: Date;
};
export type RankedLead = QueueLead & { tier: 0 | 1 | 2; reason: string };

const FINAL = new Set(["CONVERTED", "LOST", "INVALID", "DND"]);
export const RETRY_COOLDOWN_MIN = 30;

/**
 * Orders one agent's own leads into a calling queue.
 *  Tier 0: follow-ups that are due (oldest first) — a promise to the customer comes first.
 *  Tier 1: brand-new leads never called (higher priority first, then oldest).
 *  Tier 2: retries (higher priority first, then the longest since last contact).
 * Never offered: finished leads (converted/lost/invalid/DND), leads whose follow-up is still in the future,
 * and retry leads contacted within the cooldown (so a "no answer" isn't re-dialled immediately).
 * `held` counts leads waiting for a follow-up time or the cooldown.
 */
export function rankQueue(
  leads: QueueLead[], now: Date, opts: { cooldownMin?: number; excludeIds?: string[] } = {},
): { ranked: RankedLead[]; held: number } {
  const cooldown = (opts.cooldownMin ?? RETRY_COOLDOWN_MIN) * 60_000;
  const skip = new Set(opts.excludeIds ?? []);
  const ranked: RankedLead[] = [];
  let held = 0;

  for (const l of leads) {
    if (skip.has(l.id) || FINAL.has(l.status)) continue;
    if (l.nextFollowUpAt) {
      if (l.nextFollowUpAt <= now) ranked.push({ ...l, tier: 0, reason: "Follow-up due" });
      else held++;
      continue;
    }
    if (l.status === "NEW" || l.status === "ASSIGNED") { ranked.push({ ...l, tier: 1, reason: "New lead" }); continue; }
    if (l.lastContactedAt && now.getTime() - l.lastContactedAt.getTime() < cooldown) { held++; continue; }
    ranked.push({ ...l, tier: 2, reason: "Retry" });
  }

  const t = (d: Date | null) => (d ? d.getTime() : -Infinity);
  ranked.sort((a, b) =>
    a.tier - b.tier ||
    (a.tier === 0 ? t(a.nextFollowUpAt) - t(b.nextFollowUpAt) : 0) ||
    (a.tier === 1 ? PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.createdAt.getTime() - b.createdAt.getTime() : 0) ||
    (a.tier === 2 ? PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || t(a.lastContactedAt) - t(b.lastContactedAt) : 0) ||
    (a.id < b.id ? -1 : 1),
  );
  return { ranked, held };
}
