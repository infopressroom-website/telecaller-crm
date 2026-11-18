import { z } from "zod";

export const idSchema = z.string().cuid();

/** Normalises Indian mobile numbers to digits with country code, e.g. 9876543210 -> 919876543210. */
export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export const mobileSchema = z
  .string()
  .trim()
  .transform(normalizeMobile)
  .refine((v) => /^91[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number");

export const dateRangeSchema = z
  .object({ from: z.coerce.date(), to: z.coerce.date() })
  .refine((r) => r.from <= r.to, "Start date must be before end date");
