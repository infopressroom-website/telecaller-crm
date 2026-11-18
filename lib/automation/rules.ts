import { z } from "zod";
import { PRIORITY_WEIGHT, type PriorityKey } from "@/lib/distribution/engine";

export const TRIGGERS = ["FOLLOWUP_DUE", "FOLLOWUP_OVERDUE", "LEAD_UNWORKED", "LEAD_CONVERTED", "NEW_LEADS_WAITING", "EMPLOYEE_ABSENT", "END_OF_DAY"] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const ACTION_TYPES = ["NOTIFY_OWNER", "NOTIFY_MANAGER", "NOTIFY_ROLE", "ASSIGN_NEW_LEADS", "FLAG_FOR_REVIEW", "DAILY_REPORT"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const NOTIFY_ROLES = ["MANAGER", "TEAM_LEADER", "ADMIN", "QA_MANAGER", "HR_OPERATIONS"] as const;

export const ACTION_LABELS: Record<ActionType, string> = {
  NOTIFY_OWNER: "Notify the owner (telecaller)", NOTIFY_MANAGER: "Notify their manager / team leader", NOTIFY_ROLE: "Notify everyone with a role",
  ASSIGN_NEW_LEADS: "Distribute new leads using the distribution rules", FLAG_FOR_REVIEW: "Create a review task for their manager", DAILY_REPORT: "Send the daily summary",
};

export const TRIGGER_INFO: Record<Trigger, { label: string; help: string; threshold?: { label: string; unit: string; default: number; min: number; max: number }; allowed: ActionType[] }> = {
  FOLLOWUP_DUE: { label: "A follow-up becomes due", help: "Fires once when a pending follow-up's time arrives.", allowed: ["NOTIFY_OWNER", "NOTIFY_MANAGER", "NOTIFY_ROLE"] },
  FOLLOWUP_OVERDUE: { label: "A follow-up is overdue", help: "Fires once when a follow-up is still pending after the delay below.", threshold: { label: "Overdue by at least", unit: "minutes", default: 60, min: 5, max: 10080 }, allowed: ["NOTIFY_OWNER", "NOTIFY_MANAGER", "NOTIFY_ROLE"] },
  LEAD_UNWORKED: { label: "A lead has not been contacted", help: "Assigned, no call logged, and nothing happened for the time below.", threshold: { label: "Not contacted for", unit: "hours", default: 4, min: 1, max: 168 }, allowed: ["NOTIFY_OWNER", "NOTIFY_MANAGER", "NOTIFY_ROLE", "FLAG_FOR_REVIEW"] },
  LEAD_CONVERTED: { label: "A lead is converted", help: "Fires once for each conversion in the last 24 hours.", allowed: ["NOTIFY_OWNER", "NOTIFY_MANAGER", "NOTIFY_ROLE"] },
  NEW_LEADS_WAITING: { label: "New unassigned leads are waiting", help: "Checked at every run (about every minute).", threshold: { label: "When at least", unit: "new leads are waiting", default: 1, min: 1, max: 1000 }, allowed: ["ASSIGN_NEW_LEADS", "NOTIFY_ROLE"] },
  EMPLOYEE_ABSENT: { label: "An employee is absent or on leave today", help: "Uses today's attendance records.", allowed: ["NOTIFY_MANAGER", "NOTIFY_ROLE", "FLAG_FOR_REVIEW"] },
  END_OF_DAY: { label: "End of the working day", help: "Fires once a day after the hour below (India time).", threshold: { label: "After hour (0–23)", unit: "o'clock", default: 19, min: 0, max: 23 }, allowed: ["DAILY_REPORT"] },
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const actionSchema = z.object({ type: z.enum(ACTION_TYPES), role: z.enum(NOTIFY_ROLES).optional() });

export const ruleConfigSchema = z
  .object({
    name: z.string().trim().min(2, "Give the rule a name").max(80),
    trigger: z.enum(TRIGGERS),
    threshold: z.number().int().nullable().optional().transform((v) => v ?? null),
    campaignId: z.string().max(40).nullable().optional().transform((v) => v || null),
    minLeadPriority: z.enum(PRIORITIES).nullable().optional().transform((v) => v ?? null),
    actions: z.array(actionSchema).min(1, "Choose at least one action").max(3),
    isEnabled: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const info = TRIGGER_INFO[v.trigger];
    for (const [i, a] of v.actions.entries()) {
      if (!info.allowed.includes(a.type)) ctx.addIssue({ code: "custom", path: ["actions", i], message: `“${ACTION_LABELS[a.type]}” can't be used with “${info.label}”` });
      if ((a.type === "NOTIFY_ROLE") && !a.role) ctx.addIssue({ code: "custom", path: ["actions", i], message: "Choose which role to notify" });
    }
    if (info.threshold && v.threshold !== null && (v.threshold < info.threshold.min || v.threshold > info.threshold.max)) {
      ctx.addIssue({ code: "custom", path: ["threshold"], message: `${info.threshold.label}: between ${info.threshold.min} and ${info.threshold.max}` });
    }
  });
export type RuleConfig = z.infer<typeof ruleConfigSchema>;

/** Stored JSON is treated as untrusted: anything unreadable falls back to harmless defaults. */
export type StoredConditions = { campaignId: string | null; minLeadPriority: PriorityKey | null; threshold: number | null };
export function readConditions(json: unknown): StoredConditions {
  const j = (json && typeof json === "object" && !Array.isArray(json) ? json : {}) as Record<string, unknown>;
  return {
    campaignId: typeof j.campaignId === "string" && j.campaignId ? j.campaignId.slice(0, 40) : null,
    minLeadPriority: (PRIORITIES as readonly string[]).includes(String(j.minLeadPriority)) ? (j.minLeadPriority as PriorityKey) : null,
    threshold: Number.isInteger(j.threshold) ? (j.threshold as number) : null,
  };
}
export function readActions(json: unknown): { type: ActionType; role?: (typeof NOTIFY_ROLES)[number] }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => { const p = actionSchema.safeParse(x); return p.success ? [p.data] : []; }).slice(0, 3);
}

export const prioritiesAtLeast = (min: PriorityKey | null): PriorityKey[] =>
  (PRIORITIES as readonly PriorityKey[]).filter((p) => !min || PRIORITY_WEIGHT[p] >= PRIORITY_WEIGHT[min]);

export const thresholdFor = (trigger: Trigger, stored: number | null): number => stored ?? TRIGGER_INFO[trigger].threshold?.default ?? 0;

export type MessageVars = { leadName?: string; leadCode?: string; agentName?: string; due?: string; count?: number; hours?: number; minutes?: number; subject?: string };

/** Fixed, plain-text messages. `redact` removes the customer's name for notifications sent to a whole role. */
export function buildMessage(trigger: Trigger, v: MessageVars, redact = false): { title: string; body: string } {
  const lead = redact ? (v.leadCode ?? "a lead") : `${v.leadName ?? "a lead"}${v.leadCode ? ` (${v.leadCode})` : ""}`;
  const who = v.agentName ?? "A telecaller";
  switch (trigger) {
    case "FOLLOWUP_DUE": return { title: `Follow-up due: ${lead}`, body: `${who}: the follow-up${v.due ? ` for ${v.due}` : ""} is now due.` };
    case "FOLLOWUP_OVERDUE": return { title: `Follow-up overdue: ${lead}`, body: `${who}: this follow-up${v.due ? ` (was due ${v.due})` : ""} is still pending.` };
    case "LEAD_UNWORKED": return { title: `Lead not contacted: ${lead}`, body: `${who} has not contacted this lead for over ${v.hours ?? "?"} hours.` };
    case "LEAD_CONVERTED": return { title: `Lead converted: ${lead}`, body: `${who} converted this lead.` };
    case "NEW_LEADS_WAITING": return { title: `${v.count ?? 0} new lead(s) waiting`, body: "New leads are waiting to be assigned." };
    case "EMPLOYEE_ABSENT": return { title: `${v.subject ?? "An employee"} is absent today`, body: "Their pending leads may need reviewing." };
    case "END_OF_DAY": return { title: "Daily summary", body: "" };
  }
}
