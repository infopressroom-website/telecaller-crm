import { describe, expect, it } from "vitest";
import { leadWhere, scopeKindForRole } from "@/lib/auth/scope";

describe("data scope", () => {
  it("maps roles to scopes", () => {
    expect(scopeKindForRole("ADMIN")).toBe("ALL");
    expect(scopeKindForRole("MANAGER")).toBe("TEAMS");
    expect(scopeKindForRole("TEAM_LEADER")).toBe("TEAMS");
    expect(scopeKindForRole("TELECALLER")).toBe("OWN");
    expect(scopeKindForRole("VIEWER")).toBe("NONE");
  });
  it("telecaller filter is restricted to their own leads", () => {
    expect(leadWhere({ kind: "OWN", userId: "u1" })).toEqual({ archivedAt: null, ownerId: "u1" });
  });
  it("team filter covers their teams or leads they own, nothing else", () => {
    const w = leadWhere({ kind: "TEAMS", userId: "u1", teamIds: ["t1", "t2"] });
    expect(w).toEqual({ archivedAt: null, OR: [{ teamId: { in: ["t1", "t2"] } }, { ownerId: "u1" }] });
  });
  it("no-access scope matches nothing", () => {
    expect(leadWhere({ kind: "NONE" })).toEqual({ id: { in: [] } });
  });
  it("admin scope never includes archived leads", () => {
    expect(leadWhere({ kind: "ALL" })).toEqual({ archivedAt: null });
  });
});

import { callScopeWhere, followUpScopeWhere, taskScopeWhere, userScopeWhere } from "@/lib/auth/scope";

describe("scope filters for calls, follow-ups, tasks and users", () => {
  const own = { kind: "OWN", userId: "u1" } as const;
  const teams = { kind: "TEAMS" as const, userId: "u1", teamIds: ["t1"] };
  const none = { kind: "NONE" } as const;

  it("telecallers only see their own records", () => {
    expect(callScopeWhere(own)).toEqual({ agentId: "u1" });
    expect(followUpScopeWhere(own)).toEqual({ ownerId: "u1" });
    expect(taskScopeWhere(own)).toEqual({ ownerId: "u1" });
    expect(userScopeWhere(own)).toEqual({ id: "u1" });
  });
  it("team scope is limited to the user's teams", () => {
    expect(JSON.stringify(callScopeWhere(teams))).toContain('"in":["t1"]');
    expect(JSON.stringify(followUpScopeWhere(teams))).toContain('"in":["t1"]');
  });
  it("no-access scope matches nothing for every record type", () => {
    for (const w of [callScopeWhere(none), followUpScopeWhere(none), taskScopeWhere(none), userScopeWhere(none)]) {
      expect(w).toEqual({ id: { in: [] } });
    }
  });
  it("admin scope adds no restriction", () => {
    expect(callScopeWhere({ kind: "ALL" })).toEqual({});
  });
});

describe("manager scope sees unassigned leads", () => {
  it("adds team-less unowned leads only when includeUnassigned is set", () => {
    const withIt = JSON.stringify(leadWhere({ kind: "TEAMS", userId: "m1", teamIds: ["t1"], includeUnassigned: true }));
    const without = JSON.stringify(leadWhere({ kind: "TEAMS", userId: "tl1", teamIds: ["t1"] }));
    expect(withIt).toContain('"ownerId":null,"teamId":null');
    expect(without).not.toContain('"teamId":null');
  });
});
