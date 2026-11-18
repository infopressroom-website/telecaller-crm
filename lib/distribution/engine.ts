// Pure allocation engine: no database, fully deterministic, easy to test.
// The service layer loads the inputs, calls planDistribution(), then applies the plan with locking.

export const DISTRIBUTION_METHODS = ["ROUND_ROBIN", "EQUAL_DISTRIBUTION", "WORKLOAD_BASED", "CAMPAIGN_BASED", "LOCATION_BASED"] as const;
export type DistributionMethod = (typeof DISTRIBUTION_METHODS)[number];

export const METHOD_LABELS: Record<DistributionMethod, string> = {
  ROUND_ROBIN: "Round robin",
  EQUAL_DISTRIBUTION: "Equal distribution",
  WORKLOAD_BASED: "Workload based",
  CAMPAIGN_BASED: "Campaign based",
  LOCATION_BASED: "Location based",
};

export const METHOD_HELP: Record<DistributionMethod, string> = {
  ROUND_ROBIN: "Takes turns through the eligible agents in a fixed order, skipping anyone at their limit.",
  EQUAL_DISTRIBUTION: "Gives each lead to the agent who has received the fewest leads today (including this run).",
  WORKLOAD_BASED: "Gives each lead to the agent with the fewest open leads right now.",
  CAMPAIGN_BASED: "Only agents allowed for the campaign (its agent list or team) receive the lead; the lightest workload wins.",
  LOCATION_BASED: "Prefers agents whose service cities or states cover the lead's location; the lightest workload wins.",
};

export const PRIORITY_WEIGHT = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 } as const;
export type PriorityKey = keyof typeof PRIORITY_WEIGHT;

export type AgentState = {
  id: string;
  name: string;
  teamId: string | null;
  cities: string[];
  states: string[];
  activeLeads: number; // open leads they already own
  assignedToday: number; // assignments received today (any method)
  maxActive: number | null; // the agent's own cap
  dailyLimit: number | null; // the agent's own daily cap
};

export type RuleDef = {
  id: string;
  name: string;
  method: DistributionMethod;
  priority: number;
  campaignId: string | null;
  sourceId: string | null;
  minLeadPriority: PriorityKey | null;
  matchCities: string[];
  matchStates: string[];
  teamId: string | null;
  agentIds: string[]; // empty = anyone (within team, if set)
  maxActiveLeads: number | null;
  dailyLimit: number | null;
  fallbackToAny: boolean;
  cursorUserId: string | null;
};

export type LeadInput = {
  id: string;
  campaignId: string | null;
  sourceId: string | null;
  priority: PriorityKey;
  city: string | null;
  state: string | null;
  createdAt: Date;
};

export type PlannedAssignment = { leadId: string; agentId: string; ruleId: string; method: DistributionMethod };
export type Unallocated = { leadId: string; reason: string };
export type Plan = {
  assignments: PlannedAssignment[];
  unallocated: Unallocated[];
  cursors: Record<string, string>; // ruleId -> last agent id (round robin)
  agentLoad: Record<string, { before: number; after: number }>;
};

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
const stricter = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));

export function ruleMatches(rule: RuleDef, lead: LeadInput): boolean {
  if (rule.campaignId && rule.campaignId !== lead.campaignId) return false;
  if (rule.sourceId && rule.sourceId !== lead.sourceId) return false;
  if (rule.minLeadPriority && PRIORITY_WEIGHT[lead.priority] < PRIORITY_WEIGHT[rule.minLeadPriority]) return false;
  if (rule.matchCities.length && !rule.matchCities.some((c) => norm(c) === norm(lead.city))) return false;
  if (rule.matchStates.length && !rule.matchStates.some((s) => norm(s) === norm(lead.state))) return false;
  return true;
}

const inPool = (rule: RuleDef, a: AgentState) =>
  (!rule.teamId || a.teamId === rule.teamId) && (rule.agentIds.length === 0 || rule.agentIds.includes(a.id));

const hasCapacity = (rule: RuleDef, a: AgentState) => {
  const maxActive = stricter(a.maxActive, rule.maxActiveLeads);
  const daily = stricter(a.dailyLimit, rule.dailyLimit);
  return (maxActive === null || a.activeLeads < maxActive) && (daily === null || a.assignedToday < daily);
};

const byId = (a: AgentState, b: AgentState) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function pick(rule: RuleDef, candidates: AgentState[], cursor: string | null): AgentState {
  const sorted = [...candidates].sort(byId);
  if (rule.method === "ROUND_ROBIN") {
    return (cursor ? sorted.find((a) => a.id > cursor) : undefined) ?? sorted[0]!;
  }
  if (rule.method === "EQUAL_DISTRIBUTION") {
    return sorted.sort((a, b) => a.assignedToday - b.assignedToday || a.activeLeads - b.activeLeads || byId(a, b))[0]!;
  }
  // WORKLOAD_BASED, CAMPAIGN_BASED, LOCATION_BASED
  return sorted.sort((a, b) => a.activeLeads - b.activeLeads || a.assignedToday - b.assignedToday || byId(a, b))[0]!;
}

/**
 * Decides who gets each lead. Does not mutate its inputs.
 * Leads are handled urgent-first, then oldest-first; the first active rule (lowest priority number) that matches wins.
 */
export function planDistribution(leadsIn: LeadInput[], rulesIn: RuleDef[], agentsIn: AgentState[]): Plan {
  const agents = new Map(agentsIn.map((a) => [a.id, { ...a }]));
  const rules = rulesIn.filter(Boolean).sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1));
  const leads = [...leadsIn].sort(
    (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1),
  );
  const plan: Plan = { assignments: [], unallocated: [], cursors: {}, agentLoad: {} };
  for (const a of agents.values()) plan.agentLoad[a.id] = { before: a.activeLeads, after: a.activeLeads };
  const cursors = new Map(rules.map((r) => [r.id, r.cursorUserId]));

  for (const lead of leads) {
    const rule = rules.find((r) => ruleMatches(r, lead));
    if (!rule) { plan.unallocated.push({ leadId: lead.id, reason: "No active rule matches this lead" }); continue; }

    const pool = [...agents.values()].filter((a) => inPool(rule, a));
    if (pool.length === 0) { plan.unallocated.push({ leadId: lead.id, reason: `No available agents in the pool of “${rule.name}”` }); continue; }

    let candidates = pool.filter((a) => hasCapacity(rule, a));
    if (candidates.length === 0) { plan.unallocated.push({ leadId: lead.id, reason: "All eligible agents are at their limit" }); continue; }

    if (rule.method === "LOCATION_BASED") {
      const covering = candidates.filter((a) => a.cities.some((c) => norm(c) === norm(lead.city)) || a.states.some((s) => norm(s) === norm(lead.state)));
      if (covering.length === 0 && !rule.fallbackToAny) {
        plan.unallocated.push({ leadId: lead.id, reason: `No available agent covers ${lead.city || lead.state || "this location"}` });
        continue;
      }
      if (covering.length > 0) candidates = covering;
    }

    const chosen = pick(rule, candidates, cursors.get(rule.id) ?? null);
    chosen.activeLeads += 1;
    chosen.assignedToday += 1;
    plan.agentLoad[chosen.id]!.after = chosen.activeLeads;
    if (rule.method === "ROUND_ROBIN") { cursors.set(rule.id, chosen.id); plan.cursors[rule.id] = chosen.id; }
    plan.assignments.push({ leadId: lead.id, agentId: chosen.id, ruleId: rule.id, method: rule.method });
  }
  return plan;
}
