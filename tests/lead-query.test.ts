import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/leads/csv-safe";
import { buildLeadWhere } from "@/lib/leads/query";
import { leadWhere } from "@/lib/auth/scope";
import {
  bulkIdsSchema, leadInputSchema, parseLeadListQuery,
} from "@/validations/lead";

const NOW = new Date("2026-10-31T10:00:00Z");
const own = { kind: "OWN", userId: "u1" } as const;
const q = (p: Record<string, string> = {}) => parseLeadListQuery(p);

describe("buildLeadWhere", () => {
  it("always starts with the role scope, so filters can only narrow it", () => {
    const w = buildLeadWhere(own, q({ status: "NEW" }), NOW) as { AND: unknown[] };
    expect(w.AND[0]).toEqual(leadWhere(own));
  });
  it("searches digits against mobiles only when there are at least 4", () => {
    expect(JSON.stringify(buildLeadWhere(own, q({ q: "98765" }), NOW))).toContain("primaryMobile");
    expect(JSON.stringify(buildLeadWhere(own, q({ q: "ab1" }), NOW))).not.toContain("primaryMobile");
  });
  it("handles the unassigned filter", () => {
    expect(JSON.stringify(buildLeadWhere({ kind: "ALL" }, q({ ownerId: "unassigned" }), NOW))).toContain('"ownerId":null');
  });
  it("includes the whole 'created to' day (IST)", () => {
    const w = JSON.stringify(buildLeadWhere({ kind: "ALL" }, q({ createdTo: "2026-10-05" }), NOW));
    expect(w).toContain("2026-10-05T18:30:00.000Z");
  });
});

describe("list query parsing", () => {
  it("falls back safely on junk", () => {
    const r = q({ status: "BOGUS", page: "0", pageSize: "100000", sort: "evil", createdFrom: "yesterday" });
    expect(r.status).toBeUndefined();
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(25);
    expect(r.sort).toBe("created_desc");
    expect(r.createdFrom).toBeUndefined();
  });
  it("keeps valid filters", () => {
    const r = q({ status: "INTERESTED", priority: "HIGH", page: "3" });
    expect([r.status, r.priority, r.page]).toEqual(["INTERESTED", "HIGH", 3]);
  });
});

describe("lead input validation", () => {
  const base = { name: "Asha", primaryMobile: "9876543210" };
  it("normalises mobile and treats blanks as missing", () => {
    const r = leadInputSchema.parse({ ...base, alternateMobile: "", email: "", city: "" });
    expect(r.primaryMobile).toBe("919876543210");
    expect([r.alternateMobile, r.email, r.city]).toEqual([undefined, undefined, undefined]);
    expect(r.priority).toBe("MEDIUM");
  });
  it("rejects bad input with field-level errors", () => {
    const r = leadInputSchema.safeParse({ name: "", primaryMobile: "12", email: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(["email", "name", "primaryMobile"]);
  });
  it("limits bulk selections to 200", () => {
    expect(bulkIdsSchema.safeParse([]).success).toBe(false);
    expect(bulkIdsSchema.safeParse(Array.from({ length: 201 }, (_, i) => `id${i}`)).success).toBe(false);
    expect(bulkIdsSchema.safeParse(["a"]).success).toBe(true);
  });
});

describe("escapeCsvCell", () => {
  it("neutralises spreadsheet formulas", () => {
    for (const bad of ["=SUM(A1)", "+1+1", "-2+3", "@cmd", "\tx"]) expect(escapeCsvCell(bad).startsWith("'")).toBe(true);
  });
  it("leaves normal text and empty values alone", () => {
    expect(escapeCsvCell("Asha Verma")).toBe("Asha Verma");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
  });
});
