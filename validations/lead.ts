import { z } from "zod";
import { LEAD_PRIORITIES, LEAD_SORTS, LEAD_STATUSES } from "@/lib/leads/fields";
import { mobileSchema } from "./common";

const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([z.literal("").transform(() => undefined), schema]).optional();

const optionalText = (max: number) => blankToUndefined(z.string().trim().max(max));
const optionalId = blankToUndefined(z.string().trim().min(1).max(40));

export const leadInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  primaryMobile: mobileSchema,
  alternateMobile: blankToUndefined(mobileSchema),
  email: blankToUndefined(z.string().trim().toLowerCase().email("Enter a valid email").max(254)),
  city: optionalText(100),
  state: optionalText(100),
  sourceId: optionalId,
  campaignId: optionalId,
  priority: z.enum(LEAD_PRIORITIES).default("MEDIUM"),
  notes: optionalText(2000),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export const leadIdSchema = z.string().trim().min(1).max(40);
export const noteSchema = z.object({ leadId: leadIdSchema, message: z.string().trim().min(1, "Write a note first").max(2000) });
export const statusSchema = z.object({ leadId: leadIdSchema, status: z.enum(LEAD_STATUSES) });

export const bulkIdsSchema = z.array(leadIdSchema).min(1, "Select at least one lead").max(200, "Select at most 200 leads at a time");
export const bulkAssignSchema = z.object({ ids: bulkIdsSchema, ownerId: leadIdSchema });
export const bulkStatusSchema = z.object({ ids: bulkIdsSchema, status: z.enum(LEAD_STATUSES) });
export const mergeSchema = z.object({ targetId: leadIdSchema, sourceId: leadIdSchema });

// ---- list query (also the shape of a saved view) ----
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const filterId = z.string().min(1).max(40).optional().catch(undefined);

export const leadListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(LEAD_STATUSES).optional().catch(undefined),
  priority: z.enum(LEAD_PRIORITIES).optional().catch(undefined),
  sourceId: filterId,
  campaignId: filterId,
  teamId: filterId,
  ownerId: filterId, // a user id or "unassigned"
  createdFrom: dateStr,
  createdTo: dateStr,
  followUp: z.enum(["overdue", "today"]).optional().catch(undefined),
  work: z.enum(["unworked"]).optional().catch(undefined),
  sort: z.enum(LEAD_SORTS).catch("created_desc"),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

type RawParams = Record<string, string | string[] | undefined>;
export function parseLeadListQuery(params: RawParams): LeadListQuery {
  const first = (v: string | string[] | undefined) => {
    const s = Array.isArray(v) ? v[0] : v;
    return s === "" ? undefined : s;
  };
  return leadListQuerySchema.parse(Object.fromEntries(Object.keys(leadListQuerySchema.shape).map((k) => [k, first(params[k])])));
}

/** Filters worth saving (no paging). Values are validated again when a view is loaded. */
export const FILTER_KEYS = ["q", "status", "priority", "sourceId", "campaignId", "teamId", "ownerId", "createdFrom", "createdTo", "followUp", "work", "sort"] as const;
export const savedViewNameSchema = z.string().trim().min(1, "Name the view").max(60);
