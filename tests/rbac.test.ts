import { describe, expect, it } from "vitest";
import { assertCan, can, homePathFor } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors";
import { ROLE_KEYS } from "@/lib/permissions";
import { makeUser } from "./helpers";

describe("permissions — allowed", () => {
  it("super admin can do everything", () => {
    const u = makeUser("SUPER_ADMIN");
    expect(can(u, "lead", "DELETE")).toBe(true);
    expect(can(u, "settings", "MANAGE")).toBe(true);
  });
  it("telecaller can view/edit leads and log calls", () => {
    const u = makeUser("TELECALLER");
    expect(can(u, "lead", "VIEW")).toBe(true);
    expect(can(u, "call", "CREATE")).toBe(true);
  });
  it("QA manager can score calls; HR can manage attendance", () => {
    expect(can(makeUser("QA_MANAGER"), "qa", "EDIT")).toBe(true);
    expect(can(makeUser("HR_OPERATIONS"), "attendance", "MANAGE")).toBe(true);
  });
});

describe("permissions — denied", () => {
  it("telecaller cannot assign, export, delete or manage users", () => {
    const u = makeUser("TELECALLER");
    for (const a of ["ASSIGN", "EXPORT", "DELETE"] as const) expect(can(u, "lead", a)).toBe(false);
    expect(can(u, "user", "VIEW")).toBe(false);
    expect(can(u, "settings", "VIEW")).toBe(false);
  });
  it("viewer cannot see leads or change anything", () => {
    const u = makeUser("VIEWER");
    expect(can(u, "lead", "VIEW")).toBe(false);
    expect(can(u, "report", "EXPORT")).toBe(false);
  });
  it("team leader cannot export or delete leads", () => {
    const u = makeUser("TEAM_LEADER");
    expect(can(u, "lead", "EXPORT")).toBe(false);
    expect(can(u, "lead", "DELETE")).toBe(false);
  });
  it("QA manager cannot edit leads; HR cannot view calls", () => {
    expect(can(makeUser("QA_MANAGER"), "lead", "EDIT")).toBe(false);
    expect(can(makeUser("HR_OPERATIONS"), "call", "VIEW")).toBe(false);
  });
  it("only admin roles can delete leads or manage settings", () => {
    const allowed = ROLE_KEYS.filter((r) => can(makeUser(r), "lead", "DELETE"));
    expect(allowed.sort()).toEqual(["ADMIN", "SUPER_ADMIN"]);
    const settings = ROLE_KEYS.filter((r) => can(makeUser(r), "settings", "MANAGE"));
    expect(settings.sort()).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });
  it("assertCan throws a FORBIDDEN AppError", () => {
    try {
      assertCan(makeUser("VIEWER"), "lead", "VIEW");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).status).toBe(403);
    }
  });
});

describe("landing page", () => {
  it("telecallers land on the workspace, everyone else on the dashboard", () => {
    expect(homePathFor({ roleKey: "TELECALLER" })).toBe("/workspace");
    expect(homePathFor({ roleKey: "MANAGER" })).toBe("/dashboard");
  });
  it("every non-telecaller role can open the dashboard they land on", () => {
    for (const r of ROLE_KEYS.filter((k) => k !== "TELECALLER")) expect(can(makeUser(r), "dashboard", "VIEW")).toBe(true);
  });
});

describe("lead operations (Phase 05)", () => {
  it("only managers and admins can merge leads", () => {
    const who = ROLE_KEYS.filter((r) => can(makeUser(r), "lead", "MANAGE")).sort();
    expect(who).toEqual(["ADMIN", "MANAGER", "SUPER_ADMIN"]);
  });
  it("telecallers cannot create/import, assign or export leads", () => {
    const u = makeUser("TELECALLER");
    for (const a of ["CREATE", "ASSIGN", "EXPORT"] as const) expect(can(u, "lead", a)).toBe(false);
  });
  it("team leaders can assign but not import", () => {
    const u = makeUser("TEAM_LEADER");
    expect(can(u, "lead", "ASSIGN")).toBe(true);
    expect(can(u, "lead", "CREATE")).toBe(false);
  });
  it("only roles that can export have EXPORT", () => {
    expect(ROLE_KEYS.filter((r) => can(makeUser(r), "lead", "EXPORT")).sort()).toEqual(["ADMIN", "MANAGER", "SUPER_ADMIN"]);
  });
});
