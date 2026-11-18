import { z } from "zod";
import { PRESET_VALUES, resolveRange, type ResolvedRange } from "./date-range";

export type DashboardFilters = {
  range: ResolvedRange;
  teamId?: string;
  campaignId?: string;
  /** Shown to the user when their input was invalid and defaults were used. */
  notice?: string;
};

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "" ? undefined : s;
};

const schema = z.object({
  preset: z.enum(PRESET_VALUES).catch("last7"),
  from: z.string().optional(),
  to: z.string().optional(),
  teamId: z.string().cuid().optional().catch(undefined),
  campaignId: z.string().cuid().optional().catch(undefined),
});

/** Never throws: invalid input falls back to "Last 7 days" and sets `notice`. */
export function parseDashboardFilters(params: RawParams, now = new Date()): DashboardFilters {
  const p = schema.parse({
    preset: first(params.preset),
    from: first(params.from),
    to: first(params.to),
    teamId: first(params.teamId),
    campaignId: first(params.campaignId),
  });
  try {
    return { range: resolveRange(p, now), teamId: p.teamId, campaignId: p.campaignId };
  } catch (e) {
    return {
      range: resolveRange({ preset: "last7" }, now),
      teamId: p.teamId,
      campaignId: p.campaignId,
      notice: e instanceof RangeError ? `${e.message} Showing the last 7 days instead.` : undefined,
    };
  }
}
