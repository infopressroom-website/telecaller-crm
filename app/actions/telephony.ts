"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { telephonyFormSchema } from "@/lib/telephony/config";
import { reconcileCalls, retryFailedEvents, simulateSandboxEvent } from "@/services/call-service";
import { dispositionSchema } from "@/services/disposition-schema";
import { saveDisposition } from "@/services/disposition-service";
import {
  confirmVerification, disableLiveCalling, placeTestCall, saveAgentPhone, saveTelephonySettings, testCredentials,
} from "@/services/telephony-settings-service";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}
const done = (path: string, success: string): FormState => { revalidatePath(path); return { success }; };

export async function saveTelephonySettingsAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = telephonyFormSchema.safeParse({
    provider: fd.get("provider"), region: fd.get("region"), callerId: fd.get("callerId") ?? "", record: fd.get("record") === "on",
    allowedIps: String(fd.get("allowedIps") ?? "").split(/[\s,]+/).filter(Boolean), signatureEnabled: fd.get("signatureEnabled") === "on",
    signatureHeader: fd.get("signatureHeader") ?? "X-Exotel-Signature", signatureEncoding: fd.get("signatureEncoding") ?? "base64", utcOffsetMinutes: fd.get("utcOffsetMinutes") ?? 330,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings.", fieldErrors: parsed.error.flatten().fieldErrors };
  try { await saveTelephonySettings(user, parsed.data); } catch (e) { return fail(e); }
  return done("/settings/telephony", "Saved. If you changed the provider, region or business number, the test call must be repeated.");
}

export async function testCredentialsAction(_p: FormState): Promise<FormState> {
  const user = await requireUser();
  try {
    const r = await testCredentials(user);
    revalidatePath("/settings/telephony");
    return r.ok ? { success: r.message } : { error: r.message };
  } catch (e) { return fail(e); }
}

export async function placeTestCallAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try {
    const r = await placeTestCall(user, String(fd.get("agentNumber") ?? ""), String(fd.get("customerNumber") ?? ""));
    return done("/settings/telephony", `Test call requested (provider reference ${r.providerCallId}). Your first number should ring now. Answer it, confirm the second number rings and the two of you can talk, then confirm below.`);
  } catch (e) { return fail(e); }
}

export async function confirmVerificationAction(_p: FormState): Promise<FormState> {
  const user = await requireUser();
  try { await confirmVerification(user); } catch (e) { return fail(e); }
  return done("/settings/telephony", "Live calling is now enabled for telecallers.");
}

export async function disableLiveAction(_p: FormState): Promise<FormState> {
  const user = await requireUser();
  try { await disableLiveCalling(user); } catch (e) { return fail(e); }
  return done("/settings/telephony", "Live calling switched off. Agents will use their own phones.");
}

export async function retryEventsAction(_p: FormState): Promise<FormState> {
  const user = await requireUser();
  try {
    const r = await retryFailedEvents(user);
    return done("/settings/telephony", `Tried ${r.tried} stored events; ${r.stillFailing} still failing.`);
  } catch (e) { return fail(e); }
}

export async function reconcileAction(_p: FormState): Promise<FormState> {
  const user = await requireUser();
  try {
    const r = await reconcileCalls(user);
    return done("/settings/telephony", `Checked ${r.checked} unfinished calls with the provider: ${r.updated} updated, ${r.unknown} not found.`);
  } catch (e) { return fail(e); }
}

export async function saveAgentPhoneAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try { await saveAgentPhone(user, String(fd.get("userId") ?? ""), String(fd.get("phone") ?? "")); } catch (e) { return fail(e); }
  return done("/settings/telephony", "Saved.");
}

export async function simulateEventAction(fd: FormData) {
  const user = await requireUser();
  const status = String(fd.get("status"));
  if (!["completed", "no-answer", "busy", "failed"].includes(status)) return;
  await simulateSandboxEvent(user, String(fd.get("callId") ?? ""), status as "completed");
  revalidatePath(`/calls/${String(fd.get("callId"))}`);
}

export async function saveDispositionAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = dispositionSchema.safeParse({
    id: fd.get("id") ?? undefined, key: fd.get("key") || undefined, label: fd.get("label"), isConnected: fd.get("isConnected") === "on", isFinal: fd.get("isFinal") === "on",
    requiresFollowUp: fd.get("requiresFollowUp") === "on", setsLeadStatus: fd.get("setsLeadStatus") ?? "", sortOrder: fd.get("sortOrder") ?? "", isActive: fd.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", fieldErrors: parsed.error.flatten().fieldErrors };
  try { await saveDisposition(user, parsed.data); } catch (e) { return fail(e); }
  return done("/settings/dispositions", "Saved.");
}
