import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
let dummyHash: string | undefined;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= await bcrypt.hash("timing-equaliser-not-a-real-password", 12);
  await bcrypt.compare(plain, dummyHash);
}
