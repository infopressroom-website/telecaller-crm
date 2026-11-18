import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/leads/fields";

export const dispositionSchema = z.object({
  id: z.string().max(40).optional().transform((v) => v || undefined),
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,29}$/, "Use 2–30 capital letters, digits or underscores, starting with a letter").optional(),
  label: z.string().trim().min(2, "Give it a name").max(40),
  isConnected: z.boolean().default(false),
  isFinal: z.boolean().default(false),
  requiresFollowUp: z.boolean().default(false),
  setsLeadStatus: z.union([z.literal("").transform(() => null), z.enum(LEAD_STATUSES)]).nullable().optional().transform((v) => v ?? null),
  sortOrder: z.union([z.literal("").transform(() => 100), z.coerce.number().int().min(0).max(1000)]).default(100),
  isActive: z.boolean().default(true),
});
export type DispositionInput = z.infer<typeof dispositionSchema>;
