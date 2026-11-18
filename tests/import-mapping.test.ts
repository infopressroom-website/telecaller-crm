import { describe, expect, it } from "vitest";
import { guessMapping, validateImportRow, validateMapping, type Mapping } from "@/lib/leads/import-mapping";

const sources = new Map([["website", "src1"]]);
const mapping: Mapping = { Name: "name", Mobile: "primaryMobile", Email: "email", Source: "source", Priority: "priority", Junk: "" };
const row = (o: Record<string, string>) => ({ Name: "Asha", Mobile: "9876543210", Email: "", Source: "", Priority: "", Junk: "x", ...o });

describe("guessMapping", () => {
  it("recognises common header names", () => {
    expect(guessMapping(["Full Name", "Mobile Number", "E-mail", "City", "Remarks", "Whatever"])).toEqual({
      "Full Name": "name", "Mobile Number": "primaryMobile", "E-mail": "email", City: "city", Remarks: "notes", Whatever: "",
    });
  });
  it("uses each field only once", () => {
    const m = guessMapping(["Phone", "Mobile"]);
    expect(Object.values(m).filter((v) => v === "primaryMobile")).toHaveLength(1);
  });
});

describe("validateMapping", () => {
  const headers = ["a", "b", "c"];
  it("requires name and primary mobile", () => {
    expect(validateMapping({ a: "name", b: "", c: "" }, headers)).toMatch(/mobile/i);
    expect(validateMapping({ a: "primaryMobile", b: "", c: "" }, headers)).toMatch(/name/i);
  });
  it("rejects one field mapped twice", () => {
    expect(validateMapping({ a: "name", b: "name", c: "primaryMobile" }, headers)).toMatch(/more than one/);
  });
  it("accepts a good mapping", () => {
    expect(validateMapping({ a: "name", b: "primaryMobile", c: "" }, headers)).toBeNull();
  });
});

describe("validateImportRow", () => {
  it("normalises mobile numbers", () => {
    for (const m of ["9876543210", "+91 98765 43210", "09876543210", "91-9876543210"]) {
      const r = validateImportRow(row({ Mobile: m }), mapping, sources);
      expect(r.ok && r.data.primaryMobile).toBe("919876543210");
    }
  });
  it("accepts source names case-insensitively and priority in any case", () => {
    const r = validateImportRow(row({ Source: "WEBSITE", Priority: "high" }), mapping, sources);
    expect(r.ok && r.data.sourceId).toBe("src1");
    expect(r.ok && r.data.priority).toBe("HIGH");
  });
  it("reports every problem in a row, not just the first", () => {
    const r = validateImportRow(row({ Name: "", Mobile: "123", Email: "nope", Source: "Nowhere", Priority: "huge" }), mapping, sources);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(5);
  });
  it("lowercases email and ignores unmapped columns", () => {
    const r = validateImportRow(row({ Email: "A@B.COM" }), mapping, sources);
    expect(r.ok && r.data.email).toBe("a@b.com");
    expect(r.ok && Object.keys(r.data)).not.toContain("Junk");
  });
  it("rejects landline-style and non-Indian numbers", () => {
    expect(validateImportRow(row({ Mobile: "0112345678" }), mapping, sources).ok).toBe(false);
    expect(validateImportRow(row({ Mobile: "+14155550123" }), mapping, sources).ok).toBe(false);
  });
});
