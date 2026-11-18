import { describe, expect, it } from "vitest";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { fillSeries, percent } from "@/lib/dashboard-series";
import { resolveRange } from "@/lib/date-range";

// 31 Oct 2026, 15:30 IST
const NOW = new Date("2026-10-31T10:00:00Z");
const iso = (d: Date) => d.toISOString();

describe("resolveRange (IST, half-open)", () => {
  it("today", () => {
    const r = resolveRange({ preset: "today" }, NOW);
    expect(iso(r.from)).toBe("2026-10-30T18:30:00.000Z");
    expect(iso(r.to)).toBe("2026-10-31T18:30:00.000Z");
  });
  it("yesterday ends where today starts", () => {
    const r = resolveRange({ preset: "yesterday" }, NOW);
    expect(iso(r.from)).toBe("2026-10-29T18:30:00.000Z");
    expect(iso(r.to)).toBe("2026-10-30T18:30:00.000Z");
  });
  it("last 7 and last 30 days include today", () => {
    expect(iso(resolveRange({ preset: "last7" }, NOW).from)).toBe("2026-10-24T18:30:00.000Z");
    expect(iso(resolveRange({ preset: "last30" }, NOW).from)).toBe("2026-10-01T18:30:00.000Z");
  });
  it("this month starts on the 1st IST", () => {
    expect(iso(resolveRange({ preset: "this_month" }, NOW).from)).toBe("2026-09-30T18:30:00.000Z");
  });
  it("uses the IST day, not the UTC day, just after IST midnight", () => {
    const justAfterMidnightIST = new Date("2026-10-31T19:00:00Z"); // 1 Nov 00:30 IST
    expect(iso(resolveRange({ preset: "today" }, justAfterMidnightIST).from)).toBe("2026-10-31T18:30:00.000Z");
  });
  it("custom range includes the end date", () => {
    const r = resolveRange({ preset: "custom", from: "2026-10-05", to: "2026-10-07" }, NOW);
    expect(iso(r.from)).toBe("2026-10-04T18:30:00.000Z");
    expect(iso(r.to)).toBe("2026-10-07T18:30:00.000Z");
  });
  it("rejects reversed, missing, malformed and oversized custom ranges", () => {
    expect(() => resolveRange({ preset: "custom", from: "2026-10-07", to: "2026-10-05" }, NOW)).toThrow(RangeError);
    expect(() => resolveRange({ preset: "custom" }, NOW)).toThrow(RangeError);
    expect(() => resolveRange({ preset: "custom", from: "nope", to: "2026-10-05" }, NOW)).toThrow(RangeError);
    expect(() => resolveRange({ preset: "custom", from: "2024-01-01", to: "2026-01-01" }, NOW)).toThrow(RangeError);
  });
});

describe("parseDashboardFilters", () => {
  it("defaults to last 7 days", () => {
    expect(parseDashboardFilters({}, NOW).range.preset).toBe("last7");
  });
  it("ignores an unknown preset", () => {
    expect(parseDashboardFilters({ preset: "forever" }, NOW).range.preset).toBe("last7");
  });
  it("falls back with a notice on a bad custom range", () => {
    const f = parseDashboardFilters({ preset: "custom", from: "2026-10-07", to: "2026-10-01" }, NOW);
    expect(f.range.preset).toBe("last7");
    expect(f.notice).toMatch(/start date/i);
  });
  it("drops malformed team/campaign ids instead of passing them to queries", () => {
    const f = parseDashboardFilters({ teamId: "'; DROP TABLE", campaignId: "x" }, NOW);
    expect(f.teamId).toBeUndefined();
    expect(f.campaignId).toBeUndefined();
  });
  it("treats empty strings as not set", () => {
    expect(parseDashboardFilters({ preset: "", teamId: "" }, NOW).range.preset).toBe("last7");
  });
});

describe("fillSeries", () => {
  it("fills missing days with zeros", () => {
    const r = resolveRange({ preset: "custom", from: "2026-10-01", to: "2026-10-03" }, NOW);
    const s = fillSeries([{ day: "2026-10-02", attempts: 5, connected: 2 }], r.from, r.to);
    expect(s.map((p) => p.attempts)).toEqual([0, 5, 0]);
    expect(s.map((p) => p.label)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });
  it("buckets ranges over 62 days into weeks and keeps totals", () => {
    const r = resolveRange({ preset: "custom", from: "2026-01-01", to: "2026-03-31" }, NOW); // 90 days
    const s = fillSeries([{ day: "2026-01-02", attempts: 4, connected: 1 }, { day: "2026-03-30", attempts: 6, connected: 3 }], r.from, r.to);
    expect(s.length).toBe(13);
    expect(s.reduce((n, p) => n + p.attempts, 0)).toBe(10);
  });
  it("percent handles zero denominators", () => {
    expect(percent(1, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33.3);
  });
});
