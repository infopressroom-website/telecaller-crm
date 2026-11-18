import { z } from "zod";

export const TELEPHONY_PROVIDERS = ["none", "exotel", "sandbox"] as const;

// Non-secret settings only. API keys/tokens live in environment variables and are never stored or shown.
export const telephonySettingsSchema = z.object({
  provider: z.enum(TELEPHONY_PROVIDERS).catch("none"),
  region: z.enum(["singapore", "mumbai"]).catch("mumbai"),
  callerId: z.string().trim().max(20).catch(""),
  record: z.boolean().catch(true),
  allowedIps: z.array(z.string().trim().max(50)).max(50).catch([]),
  signatureEnabled: z.boolean().catch(false),
  signatureHeader: z.string().trim().min(1).max(60).catch("X-Exotel-Signature"),
  signatureEncoding: z.enum(["hex", "base64"]).catch("base64"),
  utcOffsetMinutes: z.number().int().min(-720).max(840).catch(330),
});
export type TelephonySettings = z.infer<typeof telephonySettingsSchema>;

export const verificationSchema = z
  .object({
    credentialsOkAt: z.string().optional(), testCallId: z.string().optional(), testCallAt: z.string().optional(),
    confirmedAt: z.string().optional(), confirmedBy: z.string().optional(),
  })
  .catch({});
export type Verification = z.infer<typeof verificationSchema>;

export const API_HOSTS = { singapore: "api.exotel.com", mumbai: "api.in.exotel.com" } as const;

/** Indian mobile in our storage format (91XXXXXXXXXX) to E.164. */
export const toE164 = (stored: string) => `+${stored.replace(/\D/g, "")}`;

// Strict version for the settings form (the tolerant one above silently falls back to defaults when reading stored data).
const ipRule = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;
export const telephonyFormSchema = z.object({
  provider: z.enum(TELEPHONY_PROVIDERS),
  region: z.enum(["singapore", "mumbai"]),
  callerId: z.string().trim().regex(/^(\+?[0-9]{6,15})?$/, "Enter the business number using digits only"),
  record: z.boolean(),
  allowedIps: z.array(z.string().trim().regex(ipRule, "Not a valid IP address or range")).max(50),
  signatureEnabled: z.boolean(),
  signatureHeader: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9-]+$/, "Header names use letters, digits and hyphens"),
  signatureEncoding: z.enum(["hex", "base64"]),
  utcOffsetMinutes: z.coerce.number().int().min(-720).max(840),
});
