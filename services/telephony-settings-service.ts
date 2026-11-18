import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { AppError, notFound } from "@/lib/errors";
import { telephonySettingsSchema, toE164, verificationSchema, type TelephonySettings, type Verification } from "@/lib/telephony/config";
import { ProviderError } from "@/lib/telephony/provider";
import { credentialsPresent, exotelFromEnv, resolveTelephony } from "@/lib/telephony/registry";
import { mobileSchema } from "@/validations/common";
import { audit } from "./audit-service";

const KEY = "telephony";
const VERIFY_KEY = "telephony_verification";

export async function getTelephonySettings(): Promise<TelephonySettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return telephonySettingsSchema.parse(row?.value ?? {});
}
export async function getVerification(): Promise<Verification> {
  const row = await db.setting.findUnique({ where: { key: VERIFY_KEY } });
  return verificationSchema.parse(row?.value ?? {});
}
const put = (key: string, value: unknown) =>
  db.setting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });

/** What "Start call" will do right now. Safe to call from any signed-in user's request. */
export async function getActiveTelephony() {
  const [s, v] = await Promise.all([getTelephonySettings(), getVerification()]);
  return resolveTelephony(s, v);
}

/** The public URL Exotel must call. The secret part is masked: it is never displayed or sent to the browser. */
export function webhookUrlMasked() {
  return `${(process.env.APP_URL ?? "https://your-domain").replace(/\/$/, "")}/api/webhooks/telephony/exotel/<value of EXOTEL_WEBHOOK_SECRET>`;
}
export function statusCallbackUrl(): string {
  const secret = process.env.EXOTEL_WEBHOOK_SECRET ?? "";
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (secret.length < 24) throw new ProviderError("EXOTEL_WEBHOOK_SECRET is missing or too short.", "unconfigured");
  if (!base.startsWith("https://")) throw new ProviderError("APP_URL must be a public https address so the provider can reach our webhook.", "unconfigured");
  return `${base}/api/webhooks/telephony/exotel/${secret}`;
}

export async function getTelephonyStatus(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  const [settings, verification] = await Promise.all([getTelephonySettings(), getVerification()]);
  const r = resolveTelephony(settings, verification);
  const [pendingEvents, failedEvents, unmatched, recentUnmatched] = await Promise.all([
    db.callEvent.count({ where: { status: "RECEIVED", receivedAt: { lt: new Date(Date.now() - 60_000) } } }),
    db.callEvent.count({ where: { status: "FAILED" } }),
    db.callEvent.count({ where: { status: "IGNORED" } }),
    db.callEvent.findMany({ where: { status: { in: ["IGNORED", "FAILED"] } }, orderBy: { receivedAt: "desc" }, take: 10, select: { id: true, eventType: true, status: true, note: true, receivedAt: true, providerCallId: true } }),
  ]);
  return { settings, verification, mode: r.mode, problem: r.problem, creds: credentialsPresent(), webhookUrl: webhookUrlMasked(), appUrlIsHttps: (process.env.APP_URL ?? "").startsWith("https://"), pendingEvents, failedEvents, unmatched, recentUnmatched, isProduction: process.env.NODE_ENV === "production" };
}

export async function saveTelephonySettings(user: AuthUser, input: TelephonySettings) {
  assertCan(user, "settings", "MANAGE");
  if (input.provider === "sandbox" && process.env.NODE_ENV === "production") throw new AppError("VALIDATION_ERROR", "Sandbox mode can't be used in production.");
  const before = await getTelephonySettings();
  await put(KEY, input);
  // Anything that changes how calls are placed invalidates the earlier test.
  if (before.provider !== input.provider || before.region !== input.region || before.callerId !== input.callerId) await put(VERIFY_KEY, {});
  await audit({ actorId: user.id, action: "telephony.settings", entityType: "Setting", entityId: KEY, before: before as Prisma.InputJsonValue, after: input as Prisma.InputJsonValue });
}

export async function testCredentials(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  const settings = await getTelephonySettings();
  if (settings.provider !== "exotel") throw new AppError("VALIDATION_ERROR", "Choose Exotel as the provider and save first.");
  const exotel = exotelFromEnv(settings);
  if (!exotel) throw new AppError("VALIDATION_ERROR", "Exotel credentials are not set in the server environment.");
  try {
    const r = await exotel.testCredentials();
    if (r.ok) await put(VERIFY_KEY, { ...(await getVerification()), credentialsOkAt: new Date().toISOString(), confirmedAt: undefined });
    await audit({ actorId: user.id, action: "telephony.test_credentials", entityType: "Setting", entityId: KEY, after: { ok: r.ok } });
    return r;
  } catch (e) {
    if (e instanceof ProviderError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Places ONE real call between two numbers the administrator controls, to prove the integration works end to end. */
export async function placeTestCall(user: AuthUser, agentNumber: string, customerNumber: string) {
  assertCan(user, "settings", "MANAGE");
  const settings = await getTelephonySettings();
  const verification = await getVerification();
  const exotel = settings.provider === "exotel" ? exotelFromEnv(settings) : null;
  if (!exotel) throw new AppError("VALIDATION_ERROR", "Exotel isn't selected or its credentials are missing.");
  if (!verification.credentialsOkAt) throw new AppError("VALIDATION_ERROR", "Test the credentials first.");
  if (!settings.callerId) throw new AppError("VALIDATION_ERROR", "Set the business (ExoPhone) number first.");
  if (verification.testCallAt && Date.now() - Date.parse(verification.testCallAt) < 60_000) throw new AppError("RATE_LIMITED", "Wait a minute before placing another test call.");
  const a = mobileSchema.safeParse(agentNumber), c = mobileSchema.safeParse(customerNumber);
  if (!a.success || !c.success) throw new AppError("VALIDATION_ERROR", "Enter two valid 10-digit mobile numbers.");
  try {
    const r = await exotel.placeCall({ agentNumber: toE164(a.data), customerNumber: toE164(c.data), callerId: settings.callerId, customField: `test:${user.id}`.slice(0, 128), record: false, statusCallbackUrl: statusCallbackUrl() });
    await put(VERIFY_KEY, { ...verification, testCallId: r.providerCallId, testCallAt: new Date().toISOString(), confirmedAt: undefined });
    await audit({ actorId: user.id, action: "telephony.test_call", entityType: "Setting", entityId: KEY, after: { providerCallId: r.providerCallId } });
    return { providerCallId: r.providerCallId };
  } catch (e) {
    if (e instanceof ProviderError) throw new AppError("VALIDATION_ERROR", e.message);
    throw e;
  }
}

/** The administrator attests that the test call rang and connected. Only then are agents switched to real calling. */
export async function confirmVerification(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  const v = await getVerification();
  if (!v.testCallId) throw new AppError("VALIDATION_ERROR", "Place a test call first.");
  await put(VERIFY_KEY, { ...v, confirmedAt: new Date().toISOString(), confirmedBy: user.id });
  await audit({ actorId: user.id, action: "telephony.confirm_verified", entityType: "Setting", entityId: KEY, after: { testCallId: v.testCallId } });
}

export async function disableLiveCalling(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  const v = await getVerification();
  await put(VERIFY_KEY, { ...v, confirmedAt: undefined, confirmedBy: undefined });
  await audit({ actorId: user.id, action: "telephony.disable_live", entityType: "Setting", entityId: KEY });
}

// ───────────── agent phone numbers (the number the provider rings first) ─────────────

export async function listAgentPhones(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  return db.user.findMany({ where: { status: "ACTIVE", archivedAt: null, role: { key: { in: ["TELECALLER", "TEAM_LEADER"] } } }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } });
}

export async function saveAgentPhone(user: AuthUser, userId: string, phone: string) {
  assertCan(user, "settings", "MANAGE");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("User");
  let value: string | null = null;
  if (phone.trim()) {
    const p = mobileSchema.safeParse(phone);
    if (!p.success) throw new AppError("VALIDATION_ERROR", "Enter a valid 10-digit mobile number.");
    value = p.data;
  }
  await db.user.update({ where: { id: userId }, data: { phone: value } });
  await audit({ actorId: user.id, action: "telephony.agent_phone", entityType: "User", entityId: userId, before: { phone: target.phone ? "set" : null }, after: { phone: value ? "set" : null } });
}
