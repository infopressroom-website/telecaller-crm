import "server-only";
import type { TelephonySettings, Verification } from "./config";
import { ExotelProvider } from "./exotel";
import type { TelephonyProvider } from "./provider";
import { SandboxProvider } from "./sandbox";

export type TelephonyMode = "manual" | "live" | "sandbox";
export type ResolvedTelephony = { mode: TelephonyMode; provider: TelephonyProvider | null; problem?: string };

export const credentialsPresent = () => ({
  sid: !!process.env.EXOTEL_ACCOUNT_SID, apiKey: !!process.env.EXOTEL_API_KEY, apiToken: !!process.env.EXOTEL_API_TOKEN,
  webhookSecret: (process.env.EXOTEL_WEBHOOK_SECRET ?? "").length >= 24,
});

export function exotelFromEnv(settings: TelephonySettings): ExotelProvider | null {
  const sid = process.env.EXOTEL_ACCOUNT_SID, apiKey = process.env.EXOTEL_API_KEY, apiToken = process.env.EXOTEL_API_TOKEN;
  return sid && apiKey && apiToken ? new ExotelProvider({ sid, apiKey, apiToken }, settings) : null;
}

/**
 * Decides how "Start call" behaves. Real calling is only switched on when the provider is selected, credentials exist
 * AND an administrator has confirmed a successful test call. Otherwise agents get the plain phone-dialler link ("manual").
 */
export function resolveTelephony(settings: TelephonySettings, verification: Verification): ResolvedTelephony {
  if (settings.provider === "none") return { mode: "manual", provider: null };
  if (settings.provider === "sandbox") {
    if (process.env.NODE_ENV === "production") return { mode: "manual", provider: null, problem: "Sandbox mode is disabled in production." };
    return { mode: "sandbox", provider: new SandboxProvider() };
  }
  const exotel = exotelFromEnv(settings);
  if (!exotel) return { mode: "manual", provider: null, problem: "Exotel credentials are not configured on the server." };
  if (!settings.callerId) return { mode: "manual", provider: null, problem: "The business (ExoPhone) number is not set." };
  if (!credentialsPresent().webhookSecret) return { mode: "manual", provider: null, problem: "EXOTEL_WEBHOOK_SECRET is missing or shorter than 24 characters." };
  if (!verification.confirmedAt) return { mode: "manual", provider: null, problem: "Calling is not enabled until an administrator completes and confirms the test call." };
  return { mode: "live", provider: exotel };
}
