import { z } from "zod";

export const CALL_STATUSES = ["INITIATED", "RINGING", "IN_PROGRESS", "COMPLETED", "NOT_ANSWERED", "BUSY", "FAILED", "CANCELED"] as const;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const id = z.string().min(1).max(40).optional().catch(undefined);

export const callListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  agentId: id,
  teamId: id,
  disposition: z.string().regex(/^[A-Z0-9_]{1,40}$/).optional().catch(undefined),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional().catch(undefined),
  status: z.enum(CALL_STATUSES).optional().catch(undefined),
  from: dateStr,
  to: dateStr,
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25),
});
export type CallListQuery = z.infer<typeof callListQuerySchema>;

type Raw = Record<string, string | string[] | undefined>;
export function parseCallListQuery(params: Raw): CallListQuery {
  const first = (v: string | string[] | undefined) => { const s = Array.isArray(v) ? v[0] : v; return s === "" ? undefined : s; };
  return callListQuerySchema.parse(Object.fromEntries(Object.keys(callListQuerySchema.shape).map((k) => [k, first(params[k])])));
}
