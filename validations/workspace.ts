import { z } from "zod";

const id = z.string().trim().min(1).max(40);

export const startCallSchema = z.object({ leadId: id, callRef: z.string().uuid() });

export const saveCallSchema = z.object({
  leadId: id,
  callRef: z.string().uuid(),
  dispositionId: id,
  notes: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  followUpAt: z.string().datetime().nullable().optional(),
  nextAction: z.string().trim().max(300).optional().transform((v) => v || undefined),
});
export type SaveCallInput = z.infer<typeof saveCallSchema>;

export const skipListSchema = z
  .string().max(2000).optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 40).slice(0, 50) : []));
