import { z } from "zod";
import { PRESET_VALUES, resolveRange, type ResolvedRange } from "./date-range";
import type { AnalyticsFilters } from "@/types/analytics";

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "" ? undefined : s;
};

const schema = z.object({
  preset: z.enum(PRESET_VALUES).catch("last30"),
  from: z.string().optional(),
  to: z.string().optional(),
  teamId: z.string().cuid().optional().catch(undefined),
  campaignId: z.string().cuid().optional().catch(undefined),
  sourceId: z.string().cuid().optional().catch(undefined),
  groupBy: z.enum(["day", "week", "month"]).optional().catch("day"),
});

/**
 * Parse analytics filters from search params
 * Never throws: invalid input falls back to defaults with notice
 */
export function parseAnalyticsFilters(params: RawParams, now = new Date()): AnalyticsFilters {
  const p = schema.parse({
    preset: first(params.preset),
    from: first(params.from),
    to: first(params.to),
    teamId: first(params.teamId),
    campaignId: first(params.campaignId),
    sourceId: first(params.sourceId),
    groupBy: first(params.groupBy),
  });

  try {
    return {
      range: resolveRange(p, now),
      teamId: p.teamId,
      campaignId: p.campaignId,
      sourceId: p.sourceId,
      groupBy: p.groupBy || "day",
    };
  } catch (e) {
    return {
      range: resolveRange({ preset: "last30" }, now),
      teamId: p.teamId,
      campaignId: p.campaignId,
      sourceId: p.sourceId,
      groupBy: p.groupBy || "day",
      notice: e instanceof RangeError ? `${e.message} Showing the last 30 days instead.` : undefined,
    };
  }
}
