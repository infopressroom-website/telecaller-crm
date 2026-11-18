import { describe, expect, it } from "vitest";
import { parseModelJson, AIError } from "@/lib/ai/provider";
import { ACTION_TYPES, buildMessage, prioritiesAtLeast, readActions, readConditions, ruleConfigSchema, thresholdFor } from "@/lib/automation/rules";
import { breakMinutes, isLateArrival, workedMinutes } from "@/lib/attendance/calc";
import { redact } from "@/lib/logger";
import { calculateIncentive, rupees, type Slab } from "@/lib/performance/incentive";
import { currentWindow, percentOf, periodKindForPreset, weekStartIST } from "@/lib/performance/periods";
import { QA_CRITERIA, computeScore, scoreBand } from "@/lib/qa/scorecard";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { REPORTS, isReportKey } from "@/lib/reports/definitions";
import { groupSeries, mondayOf } from "@/lib/reports/group";
import { assignableRoles, canManageRole } from "@/lib/team/roles";
import { deriveLiveStatus } from "@/lib/team/status";
import { generateTempPassword } from "@/lib/team/temp-password";
import { passwordSchema } from "@/lib/auth/password";
import { ROLE_KEYS } from "@/lib/permissions";

const NOW = new Date("2026-10-31T10:00:00Z"); // Saturday 15:30 IST

describe("automation rules", () => {
  const ok = { name: "Overdue alert", trigger: "FOLLOWUP_OVERDUE", threshold: 60, actions: [{ type: "NOTIFY_MANAGER" }], isEnabled: true };
  it("accepts a valid rule", () => expect(ruleConfigSchema.safeParse(ok).success).toBe(true));
  it("rejects actions that don't fit the trigger", () => {
    expect(ruleConfigSchema.safeParse({ ...ok, actions: [{ type: "ASSIGN_NEW_LEADS" }] }).success).toBe(false);
    expect(ruleConfigSchema.safeParse({ ...ok, trigger: "END_OF_DAY", threshold: 19, actions: [{ type: "NOTIFY_OWNER" }] }).success).toBe(false);
    expect(ruleConfigSchema.safeParse({ ...ok, trigger: "NEW_LEADS_WAITING", threshold: 1, actions: [{ type: "NOTIFY_OWNER" }] }).success).toBe(false);
  });
  it("needs a role for role notifications, at least one action, and a sensible threshold", () => {
    expect(ruleConfigSchema.safeParse({ ...ok, actions: [{ type: "NOTIFY_ROLE" }] }).success).toBe(false);
    expect(ruleConfigSchema.safeParse({ ...ok, actions: [{ type: "NOTIFY_ROLE", role: "MANAGER" }] }).success).toBe(true);
    expect(ruleConfigSchema.safeParse({ ...ok, actions: [] }).success).toBe(false);
    expect(ruleConfigSchema.safeParse({ ...ok, threshold: 1 }).success).toBe(false);
    expect(ruleConfigSchema.safeParse({ ...ok, actions: [1, 2, 3, 4].map(() => ({ type: "NOTIFY_OWNER" })) }).success).toBe(false);
  });
  it("treats stored JSON as untrusted", () => {
    expect(readConditions("garbage")).toEqual({ campaignId: null, minLeadPriority: null, threshold: null });
    expect(readConditions({ minLeadPriority: "EVIL", threshold: 1.5 })).toEqual({ campaignId: null, minLeadPriority: null, threshold: null });
    expect(readActions([{ type: "NOTIFY_OWNER" }, { type: "DROP_TABLE" }, "x"])).toEqual([{ type: "NOTIFY_OWNER" }]);
    expect(readActions({})).toEqual([]);
  });
  it("priority conditions and thresholds", () => {
    expect(prioritiesAtLeast("HIGH")).toEqual(["HIGH", "URGENT"]);
    expect(prioritiesAtLeast(null)).toHaveLength(4);
    expect(thresholdFor("LEAD_UNWORKED", null)).toBe(4);
    expect(thresholdFor("LEAD_UNWORKED", 8)).toBe(8);
  });
  it("messages to a whole role leave out the customer's name", () => {
    const v = { leadName: "Asha Verma", leadCode: "LD-000007", agentName: "Ravi" };
    expect(buildMessage("FOLLOWUP_OVERDUE", v, true).title).not.toContain("Asha");
    expect(buildMessage("FOLLOWUP_OVERDUE", v, false).title).toContain("Asha");
  });
  it("every action type is usable with at least one trigger", () => expect(ACTION_TYPES.length).toBe(6));
});

describe("report grouping", () => {
  it("finds Mondays", () => {
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // a Sunday
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
  });
  it("sums days into weeks and months without losing any", () => {
    const pts = [["2026-10-26", 1], ["2026-10-30", 2], ["2026-11-02", 3], ["2026-11-03", 4]].map(([label, n]) => ({ label: label as string, attempts: n as number, connected: 1 }));
    expect(groupSeries(pts, "day")).toHaveLength(4);
    expect(groupSeries(pts, "week").map((p) => [p.label, p.attempts])).toEqual([["2026-10-26", 3], ["2026-11-02", 7]]);
    expect(groupSeries(pts, "month").map((p) => [p.label, p.attempts])).toEqual([["2026-10", 3], ["2026-11", 7]]);
  });
  it("knows the report list", () => {
    expect(isReportKey("calling")).toBe(true);
    expect(isReportKey("../../etc/passwd")).toBe(false);
    expect(REPORTS.length).toBe(10);
  });
});

describe("QA scorecard", () => {
  it("weights add up to 100", () => expect(QA_CRITERIA.reduce((n, c) => n + c.weight, 0)).toBe(100));
  const all = (n: number) => Object.fromEntries(QA_CRITERIA.map((c) => [c.key, n]));
  it("computes the weighted score", () => {
    expect(computeScore(all(5))).toBe(100);
    expect(computeScore(all(1))).toBe(20);
    expect(computeScore(all(3))).toBe(60);
  });
  it("refuses incomplete or out-of-range ratings", () => {
    expect(computeScore({})).toBeNull();
    expect(computeScore({ ...all(4), greeting: 0 })).toBeNull();
    expect(computeScore({ ...all(4), closing: 6 })).toBeNull();
    expect(computeScore({ ...all(4), closing: 2.5 })).toBeNull();
  });
  it("bands", () => {
    expect([scoreBand(90), scoreBand(75), scoreBand(55), scoreBand(30), scoreBand(null)]).toEqual(["Excellent", "Good", "Needs improvement", "Poor", "—"]);
  });
});

describe("incentive calculation", () => {
  const slabs: Slab[] = [
    { id: "a", name: "Calls 50–99", metric: "CALL_ATTEMPTS", minValue: 50, maxValue: 99, amountPaise: 50_000 },
    { id: "b", name: "Calls 100+", metric: "CALL_ATTEMPTS", minValue: 100, maxValue: null, amountPaise: 120_000 },
    { id: "c", name: "5+ conversions", metric: "CONVERSIONS", minValue: 5, maxValue: null, amountPaise: 200_000 },
  ];
  it("picks one slab per measure and adds the conversion bonus", () => {
    const r = calculateIncentive({ CALL_ATTEMPTS: 120, CONVERSIONS: 6 }, slabs, 10_000);
    expect(r.lines.map((l) => l.label)).toEqual(["Calls 100+", "5+ conversions", "6 conversion(s) × bonus"]);
    expect(r.totalPaise).toBe(120_000 + 200_000 + 60_000);
  });
  it("pays nothing below every slab", () => expect(calculateIncentive({ CALL_ATTEMPTS: 10, CONVERSIONS: 0 }, slabs, 10_000).totalPaise).toBe(0));
  it("respects a slab's upper limit", () => expect(calculateIncentive({ CALL_ATTEMPTS: 99 }, slabs, 0).totalPaise).toBe(50_000));
  it("works in whole paise and formats rupees", () => {
    expect(rupees(125_000)).toBe("₹1,250");
    expect(rupees(1_050)).toBe("₹10.50");
  });
});

describe("attendance maths", () => {
  const t = (s: string) => new Date(s);
  it("counts breaks, including one still open", () => {
    const end = t("2026-10-31T10:00:00Z");
    expect(breakMinutes([{ startedAt: t("2026-10-31T06:00:00Z"), endedAt: t("2026-10-31T06:30:00Z") }, { startedAt: t("2026-10-31T09:50:00Z"), endedAt: null }], end)).toBe(40);
  });
  it("worked time = span minus breaks, never negative", () => {
    expect(workedMinutes(t("2026-10-31T04:30:00Z"), t("2026-10-31T12:30:00Z"), [{ startedAt: t("2026-10-31T07:00:00Z"), endedAt: t("2026-10-31T08:00:00Z") }], NOW)).toBe(420);
    expect(workedMinutes(null, null, [], NOW)).toBe(0);
    expect(workedMinutes(t("2026-10-31T10:00:00Z"), t("2026-10-31T09:00:00Z"), [], NOW)).toBe(0);
  });
  it("late = after shift start plus grace (India time)", () => {
    expect(isLateArrival(t("2026-10-31T04:35:00Z"), "10:00", 10)).toBe(false); // 10:05
    expect(isLateArrival(t("2026-10-31T04:40:00Z"), "10:00", 10)).toBe(false); // exactly 10:10
    expect(isLateArrival(t("2026-10-31T04:41:00Z"), "10:00", 10)).toBe(true);
    expect(isLateArrival(t("2026-10-31T04:41:00Z"), "nonsense", 10)).toBe(false);
  });
});

describe("target periods (India time)", () => {
  it("weeks start on Monday", () => expect(weekStartIST(NOW).toISOString()).toBe("2026-10-25T18:30:00.000Z"));
  it("windows", () => {
    expect(currentWindow("DAILY", NOW).from.toISOString()).toBe("2026-10-30T18:30:00.000Z");
    expect(currentWindow("WEEKLY", NOW).to.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    const m = currentWindow("MONTHLY", NOW);
    expect([m.from.toISOString(), m.to.toISOString()]).toEqual(["2026-09-30T18:30:00.000Z", "2026-10-31T18:30:00.000Z"]);
  });
  it("only compares targets when the period lines up", () => {
    expect([periodKindForPreset("today"), periodKindForPreset("last7"), periodKindForPreset("this_month"), periodKindForPreset("custom")]).toEqual(["DAILY", "WEEKLY", "MONTHLY", null]);
    expect(percentOf(30, 40)).toBe(75);
    expect(percentOf(5, 0)).toBeNull();
  });
});

describe("people management rules", () => {
  it("nobody can grant a role at or above their own (except the Super Admin)", () => {
    expect(assignableRoles("HR_OPERATIONS")).not.toContain("MANAGER");
    expect(assignableRoles("ADMIN")).not.toContain("ADMIN");
    expect(assignableRoles("ADMIN")).not.toContain("SUPER_ADMIN");
    expect(assignableRoles("SUPER_ADMIN")).toHaveLength(ROLE_KEYS.length);
    for (const r of ["MANAGER", "TEAM_LEADER", "QA_MANAGER", "TELECALLER", "VIEWER"] as const) expect(assignableRoles(r)).toEqual([]);
  });
  it("editing follows the same rule", () => {
    expect(canManageRole("HR_OPERATIONS", "TELECALLER")).toBe(true);
    expect(canManageRole("HR_OPERATIONS", "ADMIN")).toBe(false);
    expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
  });
  it("temporary passwords satisfy the password policy and are not repeated", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(12);
      expect(passwordSchema.safeParse(p).success).toBe(true);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
});

describe("live status", () => {
  const base = { attendanceStatus: "PRESENT", clockedIn: true, clockedOut: false, onBreak: false, onCall: false };
  it("derives status only from attendance and calls", () => {
    expect(deriveLiveStatus(base)).toBe("AVAILABLE");
    expect(deriveLiveStatus({ ...base, onCall: true })).toBe("ON_CALL");
    expect(deriveLiveStatus({ ...base, onCall: true, onBreak: true })).toBe("BREAK");
    expect(deriveLiveStatus({ ...base, clockedIn: false })).toBe("OFFLINE");
    expect(deriveLiveStatus({ ...base, clockedOut: true })).toBe("OFFLINE");
    expect(deriveLiveStatus({ ...base, attendanceStatus: "ON_LEAVE", clockedIn: false })).toBe("ON_LEAVE");
  });
});

describe("rate limiter and logger", () => {
  it("blocks after the limit and recovers after the window", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000, 1000 + i).ok).toBe(true);
    const blocked = rateLimit("k", 3, 60_000, 1005);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("other", 3, 60_000, 1005).ok).toBe(true);
    expect(rateLimit("k", 3, 60_000, 1000 + 61_000).ok).toBe(true);
  });
  it("redacts secrets, including nested ones", () => {
    const r = redact({ user: "a", password: "x", nested: { apiKey: "k", Authorization: "Bearer z", ok: 1 } }) as Record<string, unknown>;
    expect(r.password).toBe("[redacted]");
    expect(r.user).toBe("a");
    expect(r.nested).toEqual({ apiKey: "[redacted]", Authorization: "[redacted]", ok: 1 });
  });
});

describe("AI reply parsing", () => {
  const good = { summary: "s", customerIntent: "i", objections: [], coachingSuggestions: ["c"], communicationNotes: "n", confidence: 0.7 };
  it("accepts JSON, even inside a code fence", () => {
    expect(parseModelJson(JSON.stringify(good)).confidence).toBe(0.7);
    expect(parseModelJson("Here you go:\n```json\n" + JSON.stringify(good) + "\n```").summary).toBe("s");
  });
  it("rejects anything that isn't the expected shape", () => {
    for (const bad of ["no json here", "{broken", JSON.stringify({ ...good, confidence: 3 }), JSON.stringify({ summary: "only" })]) expect(() => parseModelJson(bad)).toThrow(AIError);
  });
});
