import type { LeadStatusValue } from "@/lib/leads/fields";

const RANK: Partial<Record<LeadStatusValue, number>> = { NEW: 0, ASSIGNED: 0, ATTEMPTED: 1, CONNECTED: 2, FOLLOW_UP: 3, INTERESTED: 4, QUALIFIED: 5 };
const FINAL = new Set<LeadStatusValue>(["CONVERTED", "LOST", "INVALID", "DND"]);
const DECISIVE = new Set<LeadStatusValue>(["CONVERTED", "LOST", "INVALID", "DND"]);

// What each call outcome means for the lead (keys match the seeded dispositions).
const TARGET: Record<string, LeadStatusValue> = {
  NOT_ANSWERED: "ATTEMPTED", BUSY: "ATTEMPTED", SWITCHED_OFF: "ATTEMPTED", CONNECTED: "CONNECTED", INTERESTED: "INTERESTED",
  CALLBACK_REQUESTED: "FOLLOW_UP", NOT_INTERESTED: "LOST", WRONG_NUMBER: "INVALID", DND: "DND", CONVERTED: "CONVERTED",
};

/**
 * The lead's new status after a call, or null to leave it alone.
 * - Decisive outcomes (converted, not interested, wrong number, DND) always apply.
 * - Softer outcomes only move a lead forward, never backwards (a "no answer" never downgrades an interested lead).
 * - A lost/invalid/DND lead can be reopened by an Interested or Callback outcome. A converted lead is never changed by a call.
 */
export function nextLeadStatus(current: LeadStatusValue, dispositionKey: string, override?: LeadStatusValue | null): LeadStatusValue | null {
  const target = override ?? TARGET[dispositionKey]; // configurable outcomes can name their own target status
  if (!target || target === current || current === "CONVERTED") return null;
  if (DECISIVE.has(target)) return target;
  if (FINAL.has(current)) return target === "INTERESTED" || target === "FOLLOW_UP" ? target : null;
  return (RANK[target] ?? 0) >= (RANK[current] ?? 0) ? target : null;
}

export type CallStatusValue = "COMPLETED" | "NOT_ANSWERED" | "BUSY" | "FAILED";

export function callStatusFor(dispositionKey: string, isConnected: boolean): CallStatusValue {
  if (isConnected) return "COMPLETED";
  if (dispositionKey === "NOT_ANSWERED") return "NOT_ANSWERED";
  if (dispositionKey === "BUSY") return "BUSY";
  if (dispositionKey === "SWITCHED_OFF" || dispositionKey === "WRONG_NUMBER") return "FAILED";
  return "COMPLETED";
}

/** Callback outcomes (and any outcome an admin marks "requires follow-up") force the agent to schedule one. */
export const requiresFollowUp = (d: { key: string; requiresFollowUp?: boolean }): boolean => !!d.requiresFollowUp || d.key === "CALLBACK_REQUESTED";
