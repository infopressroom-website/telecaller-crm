import { describe, expect, it } from "vitest";
import { rankQueue, type QueueLead } from "@/lib/workspace/queue";
import { callStatusFor, nextLeadStatus } from "@/lib/workspace/status";
import { saveCallSchema, skipListSchema } from "@/validations/workspace";

const NOW = new Date("2026-10-31T10:00:00Z");
const mins = (n: number) => new Date(NOW.getTime() + n * 60_000);
let seq = 0;
const lead = (o: Partial<QueueLead> = {}): QueueLead => ({
  id: `l${String(++seq).padStart(3, "0")}`, name: "x", status: "ASSIGNED", priority: "MEDIUM", nextFollowUpAt: null, lastContactedAt: null, createdAt: new Date(2026, 0, seq), ...o,
});
const ids = (r: ReturnType<typeof rankQueue>) => r.ranked.map((l) => l.id);

describe("rankQueue", () => {
  it("serves due follow-ups first (oldest due first), then new leads, then retries", () => {
    const dueOld = lead({ status: "INTERESTED", nextFollowUpAt: mins(-120) });
    const dueNew = lead({ status: "FOLLOW_UP", nextFollowUpAt: mins(-5) });
    const fresh = lead();
    const retry = lead({ status: "ATTEMPTED", lastContactedAt: mins(-300) });
    expect(ids(rankQueue([retry, fresh, dueNew, dueOld], NOW))).toEqual([dueOld.id, dueNew.id, fresh.id, retry.id]);
  });
  it("puts urgent new leads ahead of older low-priority ones", () => {
    const low = lead({ priority: "LOW", createdAt: new Date(2020, 0, 1) });
    const urgent = lead({ priority: "URGENT", createdAt: new Date(2026, 5, 1) });
    expect(ids(rankQueue([low, urgent], NOW))).toEqual([urgent.id, low.id]);
  });
  it("holds back leads whose follow-up is still in the future", () => {
    const later = lead({ status: "FOLLOW_UP", nextFollowUpAt: mins(90) });
    const r = rankQueue([later], NOW);
    expect(r.ranked).toHaveLength(0);
    expect(r.held).toBe(1);
  });
  it("does not re-offer a retry lead until the cool-down has passed", () => {
    const recent = lead({ status: "ATTEMPTED", lastContactedAt: mins(-10) });
    const old = lead({ status: "ATTEMPTED", lastContactedAt: mins(-40) });
    const r = rankQueue([recent, old], NOW);
    expect(ids(r)).toEqual([old.id]);
    expect(r.held).toBe(1);
  });
  it("a due follow-up ignores the cool-down", () => {
    const l = lead({ status: "FOLLOW_UP", nextFollowUpAt: mins(-1), lastContactedAt: mins(-2) });
    expect(ids(rankQueue([l], NOW))).toEqual([l.id]);
  });
  it("never offers finished leads or skipped ones", () => {
    const done = ["CONVERTED", "LOST", "INVALID", "DND"].map((status) => lead({ status }));
    const skipped = lead();
    const ok = lead();
    expect(ids(rankQueue([...done, skipped, ok], NOW, { excludeIds: [skipped.id] }))).toEqual([ok.id]);
  });
  it("is deterministic and leaves its input untouched", () => {
    const input = [lead(), lead(), lead()];
    const copy = [...input];
    expect(ids(rankQueue(input, NOW))).toEqual(ids(rankQueue(input, NOW)));
    expect(input).toEqual(copy);
  });
});

describe("nextLeadStatus", () => {
  it.each([
    ["ASSIGNED", "NOT_ANSWERED", "ATTEMPTED"],
    ["ATTEMPTED", "CONNECTED", "CONNECTED"],
    ["CONNECTED", "INTERESTED", "INTERESTED"],
    ["ASSIGNED", "CALLBACK_REQUESTED", "FOLLOW_UP"],
    ["INTERESTED", "CONVERTED", "CONVERTED"],
    ["ASSIGNED", "WRONG_NUMBER", "INVALID"],
    ["INTERESTED", "NOT_INTERESTED", "LOST"],
    ["INTERESTED", "DND", "DND"],
    ["LOST", "INTERESTED", "INTERESTED"],
    ["INVALID", "CALLBACK_REQUESTED", "FOLLOW_UP"],
  ] as const)("%s + %s → %s", (current, key, expected) => {
    expect(nextLeadStatus(current, key)).toBe(expected);
  });
  it.each([
    ["ATTEMPTED", "NOT_ANSWERED"], ["INTERESTED", "NOT_ANSWERED"], ["CONNECTED", "BUSY"], ["FOLLOW_UP", "CALLBACK_REQUESTED"],
    ["QUALIFIED", "INTERESTED"], ["LOST", "NOT_ANSWERED"], ["CONVERTED", "NOT_INTERESTED"], ["CONVERTED", "DND"], ["ASSIGNED", "SOMETHING_ELSE"],
  ] as const)("%s + %s leaves the status alone", (current, key) => {
    expect(nextLeadStatus(current, key)).toBeNull();
  });
});

describe("callStatusFor", () => {
  it("maps outcomes to call statuses", () => {
    expect(callStatusFor("INTERESTED", true)).toBe("COMPLETED");
    expect(callStatusFor("NOT_ANSWERED", false)).toBe("NOT_ANSWERED");
    expect(callStatusFor("BUSY", false)).toBe("BUSY");
    expect(callStatusFor("SWITCHED_OFF", false)).toBe("FAILED");
    expect(callStatusFor("WRONG_NUMBER", false)).toBe("FAILED");
    expect(callStatusFor("DND", false)).toBe("COMPLETED");
  });
});

describe("saveCallSchema", () => {
  const base = { leadId: "lead1", callRef: "3f1c2d34-5b6a-4c7d-8e9f-0a1b2c3d4e5f", dispositionId: "d1" };
  it("accepts a minimal valid payload and trims blank notes away", () => {
    const r = saveCallSchema.parse({ ...base, notes: "   " });
    expect(r.notes).toBeUndefined();
  });
  it("requires a UUID call reference (this is what makes retries safe)", () => {
    expect(saveCallSchema.safeParse({ ...base, callRef: "abc" }).success).toBe(false);
  });
  it("only accepts ISO timestamps for the follow-up", () => {
    expect(saveCallSchema.safeParse({ ...base, followUpAt: "tomorrow" }).success).toBe(false);
    expect(saveCallSchema.safeParse({ ...base, followUpAt: "2026-11-01T04:30:00.000Z" }).success).toBe(true);
    expect(saveCallSchema.safeParse({ ...base, followUpAt: null }).success).toBe(true);
  });
  it("limits note length", () => {
    expect(saveCallSchema.safeParse({ ...base, notes: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("skipListSchema", () => {
  it("parses, trims and limits the skip list", () => {
    expect(skipListSchema.parse("a, b ,,c")).toEqual(["a", "b", "c"]);
    expect(skipListSchema.parse(undefined)).toEqual([]);
    expect(skipListSchema.parse(Array.from({ length: 80 }, (_, i) => `id${i}`).join(","))).toHaveLength(50);
  });
});
