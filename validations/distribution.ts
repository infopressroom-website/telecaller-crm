import { z } from "zod";
import { DISTRIBUTION_METHODS } from "@/lib/distribution/engine";
import { LEAD_PRIORITIES } from "@/lib/leads/fields";

const idOrBlank = z.union([z.literal("").transform(() => null), z.string().trim().min(1).max(40)]).nullable().optional().transform((v) => v ?? null);
const intOrBlank = (max: number) =>
  z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(max)]).nullable().optional().transform((v) => v ?? null);
const list = z
  .string().trim().max(600).optional()
  .transform((v) => (v ? [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 30) : []));

export const ruleSchema = z
  .object({
    name: z.string().trim().min(2, "Give the rule a name").max(80),
    method: z.enum(DISTRIBUTION_METHODS),
    priority: z.union([z.literal("").transform(() => 100), z.coerce.number().int().min(1).max(1000)]).default(100),
    campaignId: idOrBlank,
    sourceId: idOrBlank,
    minLeadPriority: z.union([z.literal("").transform(() => null), z.enum(LEAD_PRIORITIES)]).nullable().optional().transform((v) => v ?? null),
    matchCities: list,
    matchStates: list,
    teamId: idOrBlank,
    agentIds: z.array(z.string().min(1).max(40)).max(200).default([]),
    maxActiveLeads: intOrBlank(10000),
    dailyLimit: intOrBlank(10000),
    fallbackToAny: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.method === "CAMPAIGN_BASED") {
      if (!v.campaignId) ctx.addIssue({ code: "custom", path: ["campaignId"], message: "Choose the campaign this rule is for" });
      if (!v.teamId && v.agentIds.length === 0) ctx.addIssue({ code: "custom", path: ["agentIds"], message: "Choose a team or at least one agent allowed for this campaign" });
    }
  });
export type RuleInput = z.infer<typeof ruleSchema>;

export const agentSettingsSchema = z.object({
  userId: z.string().min(1).max(40),
  assignmentPaused: z.boolean().default(false),
  maxActiveLeads: intOrBlank(10000),
  dailyLeadLimit: intOrBlank(10000),
  serviceCities: list,
  serviceStates: list,
});

export const settingsSchema = z.object({ unworkedAfterHours: z.coerce.number().int().min(1, "At least 1 hour").max(168, "At most 168 hours (7 days)") });

export const runSchema = z.object({
  runId: z.string().uuid(),
  mode: z.enum(["UNASSIGNED", "ABSENT_OWNERS"]),
});

export const decisionSchema = z.object({
  id: z.string().min(1).max(40),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().transform((v) => v || undefined),
});
