import { describe, expect, it } from "vitest";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema, resetPasswordSchema } from "@/validations/auth";

describe("password policy", () => {
  it("accepts a strong password", () => expect(passwordSchema.safeParse("Sufficient9Strength").success).toBe(true));
  it.each(["short1A", "alllowercase123", "ALLUPPERCASE123", "NoNumbersHereAtAll"])("rejects %s", (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(false);
  });
  it("hashes and verifies", async () => {
    const h = await hashPassword("Sufficient9Strength");
    expect(h).not.toContain("Sufficient9Strength");
    expect(await verifyPassword("Sufficient9Strength", h)).toBe(true);
    expect(await verifyPassword("wrong-password", h)).toBe(false);
  });
  it("reset requires matching confirmation", () => {
    const r = resetPasswordSchema.safeParse({ token: "x".repeat(30), password: "Sufficient9Strength", confirm: "Different9Strength" });
    expect(r.success).toBe(false);
  });
  it("change rejects reusing the current password", () => {
    const r = changePasswordSchema.safeParse({ current: "Sufficient9Strength", password: "Sufficient9Strength", confirm: "Sufficient9Strength" });
    expect(r.success).toBe(false);
  });
});
