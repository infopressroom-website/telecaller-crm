import { describe, expect, it } from "vitest";
import { planDistribution, ruleMatches, type AgentState, type LeadInput, type RuleDef } from "@/lib/distribution/engine";

const agent = (id: string, o: Partial<AgentState> = {}): AgentState => ({
  id, name: id, teamId: null, cities: [], states: [], activeLeads: 0, assignedToday: 0, maxActive: null, dailyLimit: null, ...o,
});
const rule = (o: Partial<RuleDef> = {}): RuleDef => ({
  id: "r1", name: "Default", method: "ROUND_ROBIN", priority: 100, campaignId: null, sourceId: null, minLeadPriority: null,
  matchCities: [], matchStates: [], teamId: null, agentIds: [], maxActiveLeads: null, dailyLimit: null, fallbackToAny: false, cursorUserId: null, ...o,
});
let n = 0;
const lead = (o: Partial<LeadInput> = {}): LeadInput => ({
  id: `l${String(++n).padStart(3, "0")}`, campaignId: null, sourceId: null, priority: "MEDIUM", city: null, state: null, createdAt: new Date(2026, 0, n), ...o,
});
const who = (p: ReturnType<typeof planDistribution>) => p.assignments.map((a) => a.agentId);

describe("round robin", () => {
  it("takes turns and is fair", () => {
    const p = planDistribution([lead(), lead(), lead(), lead(), lead(), lead()], [rule()], [agent("a"), agent("b"), agent("c")]);
    expect(who(p)).toEqual(["a", "b", "c", "a", "b", "c"]);
  });
  it("continues from the saved position", () => {
    const p = planDistribution([lead(), lead()], [rule({ cursorUserId: "a" })], [agent("a"), agent("b"), agent("c")]);
    expect(who(p)).toEqual(["b", "c"]);
    expect(p.cursors.r1).toBe("c");
  });
  it("skips agents at their cap", () => {
    const p = planDistribution([lead(), lead(), lead()], [rule()], [agent("a", { maxActive: 1, activeLeads: 1 }), agent("b")]);
    expect(who(p)).toEqual(["b", "b", "b"]);
  });
});

describe("limits", () => {
  it("never exceeds an agent's max active leads, and reports the rest", () => {
    const p = planDistribution([lead(), lead(), lead()], [rule({ method: "WORKLOAD_BASED" })], [agent("a", { maxActive: 2 })]);
    expect(p.assignments).toHaveLength(2);
    expect(p.unallocated).toEqual([{ leadId: expect.any(String), reason: "All eligible agents are at their limit" }]);
  });
  it("uses the stricter of rule and agent daily limits", () => {
    const p = planDistribution([lead(), lead(), lead()], [rule({ dailyLimit: 1 })], [agent("a", { dailyLimit: 5 })]);
    expect(p.assignments).toHaveLength(1);
  });
  it("counts today's earlier assignments toward the daily limit", () => {
    const p = planDistribution([lead()], [rule({ dailyLimit: 3 })], [agent("a", { assignedToday: 3 })]);
    expect(p.assignments).toHaveLength(0);
  });
});

describe("workload and equal distribution", () => {
  it("workload gives leads to the lightest agent first", () => {
    const p = planDistribution([lead(), lead(), lead()], [rule({ method: "WORKLOAD_BASED" })], [agent("a", { activeLeads: 5 }), agent("b", { activeLeads: 1 })]);
    expect(who(p)).toEqual(["b", "b", "b"]);
  });
  it("workload evens out as it goes", () => {
    const p = planDistribution([lead(), lead(), lead(), lead()], [rule({ method: "WORKLOAD_BASED" })], [agent("a", { activeLeads: 2 }), agent("b", { activeLeads: 0 })]);
    expect(who(p).filter((x) => x === "a")).toHaveLength(1);
    expect(p.agentLoad.a!.after + p.agentLoad.b!.after).toBe(2 + 4);
  });
  it("equal distribution ignores old workload and balances today's intake", () => {
    const p = planDistribution([lead(), lead()], [rule({ method: "EQUAL_DISTRIBUTION" })], [agent("a", { assignedToday: 4, activeLeads: 0 }), agent("b", { assignedToday: 0, activeLeads: 50 })]);
    expect(who(p)).toEqual(["b", "b"]);
  });
});

describe("campaign and location", () => {
  it("campaign rule only uses its own pool", () => {
    const p = planDistribution([lead({ campaignId: "c1" }), lead({ campaignId: "c1" })], [rule({ method: "CAMPAIGN_BASED", campaignId: "c1", agentIds: ["b"] })], [agent("a"), agent("b")]);
    expect(who(p)).toEqual(["b", "b"]);
  });
  it("a rule never applies to other campaigns", () => {
    const p = planDistribution([lead({ campaignId: "other" })], [rule({ campaignId: "c1" })], [agent("a")]);
    expect(p.unallocated[0]?.reason).toMatch(/No active rule/);
  });
  it("location prefers covering agents (case-insensitive)", () => {
    const p = planDistribution([lead({ city: "PUNE" })], [rule({ method: "LOCATION_BASED" })], [agent("a", { cities: ["Delhi"] }), agent("b", { cities: ["pune"] })]);
    expect(who(p)).toEqual(["b"]);
  });
  it("location with no coverage is unallocated unless fallback is on", () => {
    const l = () => lead({ city: "Goa" });
    const agents = [agent("a", { cities: ["Delhi"] })];
    expect(planDistribution([l()], [rule({ method: "LOCATION_BASED" })], agents).unallocated[0]?.reason).toMatch(/covers Goa/);
    expect(who(planDistribution([l()], [rule({ method: "LOCATION_BASED", fallbackToAny: true })], agents))).toEqual(["a"]);
  });
  it("matches by state too", () => {
    const p = planDistribution([lead({ city: "Nowhere", state: "Maharashtra" })], [rule({ method: "LOCATION_BASED" })], [agent("a", { states: ["maharashtra"] }), agent("b")]);
    expect(who(p)).toEqual(["a"]);
  });
});

describe("rules and ordering", () => {
  it("the first matching rule by priority number wins", () => {
    const rules = [rule({ id: "slow", name: "Slow", priority: 200, agentIds: ["a"] }), rule({ id: "fast", name: "Fast", priority: 10, campaignId: "c1", agentIds: ["b"] })];
    const p = planDistribution([lead({ campaignId: "c1" }), lead()], rules, [agent("a"), agent("b")]);
    expect(p.assignments.map((x) => [x.agentId, x.ruleId])).toEqual([["b", "fast"], ["a", "slow"]]);
  });
  it("urgent leads are handled before older low-priority ones when capacity is short", () => {
    const old = lead({ priority: "LOW", createdAt: new Date(2020, 0, 1) });
    const urgent = lead({ priority: "URGENT", createdAt: new Date(2026, 5, 1) });
    const p = planDistribution([old, urgent], [rule({ method: "WORKLOAD_BASED" })], [agent("a", { maxActive: 1 })]);
    expect(p.assignments.map((x) => x.leadId)).toEqual([urgent.id]);
    expect(p.unallocated.map((x) => x.leadId)).toEqual([old.id]);
  });
  it("minimum lead priority filter", () => {
    expect(ruleMatches(rule({ minLeadPriority: "HIGH" }), lead({ priority: "MEDIUM" }))).toBe(false);
    expect(ruleMatches(rule({ minLeadPriority: "HIGH" }), lead({ priority: "URGENT" }))).toBe(true);
  });
  it("team pool restricts candidates", () => {
    const p = planDistribution([lead()], [rule({ teamId: "t1" })], [agent("a", { teamId: "t2" }), agent("b", { teamId: "t1" })]);
    expect(who(p)).toEqual(["b"]);
  });
  it("reports an empty pool and no agents clearly", () => {
    expect(planDistribution([lead()], [rule({ agentIds: ["zzz"] })], [agent("a")]).unallocated[0]?.reason).toMatch(/No available agents/);
    expect(planDistribution([lead()], [], [agent("a")]).unallocated[0]?.reason).toMatch(/No active rule/);
  });
  it("is deterministic and does not mutate its inputs", () => {
    const agents = [agent("b"), agent("a")];
    const leads = [lead(), lead(), lead()];
    const first = planDistribution(leads, [rule()], agents);
    expect(planDistribution(leads, [rule()], agents)).toEqual(first);
    expect(agents.map((a) => a.activeLeads)).toEqual([0, 0]);
  });
  it("assigns every lead exactly once", () => {
    const leads = Array.from({ length: 50 }, () => lead());
    const p = planDistribution(leads, [rule({ method: "WORKLOAD_BASED" })], [agent("a"), agent("b"), agent("c")]);
    expect(new Set(p.assignments.map((a) => a.leadId)).size).toBe(50);
  });
});
