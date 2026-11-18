"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { ACTION_TYPES, NOTIFY_ROLES, ruleConfigSchema } from "@/lib/automation/rules";
import { deleteRule, runNow, saveRule, setRuleEnabled, testRule } from "@/services/automation-service";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function saveAutomationRuleAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const role = String(fd.get("notifyRole") ?? "");
  const actions = ACTION_TYPES.filter((t) => fd.get(`action:${t}`) === "on").map((type) => ({ type, ...(NOTIFY_ROLES as readonly string[]).includes(role) && (type === "NOTIFY_ROLE" || type === "DAILY_REPORT") ? { role: role as (typeof NOTIFY_ROLES)[number] } : {} }));
  const th = String(fd.get("threshold") ?? "").trim();
  const parsed = ruleConfigSchema.safeParse({
    name: fd.get("name"), trigger: fd.get("trigger"), threshold: th === "" ? null : Number(th), campaignId: fd.get("campaignId") || null,
    minLeadPriority: fd.get("minLeadPriority") || null, actions, isEnabled: fd.get("isEnabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the rule.", fieldErrors: parsed.error.flatten().fieldErrors };
  try { await saveRule(user, String(fd.get("ruleId") ?? "") || null, parsed.data); } catch (e) { return fail(e); }
  revalidatePath("/automation");
  redirect("/automation");
}

export async function toggleAutomationAction(fd: FormData) {
  const user = await requireUser();
  await setRuleEnabled(user, String(fd.get("id") ?? ""), fd.get("enabled") === "true");
  revalidatePath("/automation");
}

export async function deleteAutomationAction(fd: FormData) {
  const user = await requireUser();
  await deleteRule(user, String(fd.get("id") ?? ""));
  revalidatePath("/automation");
}

export async function testAutomationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try {
    const r = await testRule(user, String(fd.get("id") ?? ""));
    return { success: r.matches === 0 ? "Test: nothing matches right now, so nothing would happen. (Nothing was sent.)" : `Test: ${r.matches} item(s) match right now, e.g. ${r.sample.slice(0, 3).join("; ")}. (Nothing was sent.)` };
  } catch (e) { return fail(e); }
}

export async function runAutomationNowAction(_p: FormState): Promise<FormState> {
  const user = await requireUser();
  try {
    const t = await runNow(user);
    const done = t.rules.reduce((n, r) => n + r.processed, 0), failed = t.rules.reduce((n, r) => n + r.failed, 0);
    revalidatePath("/automation");
    return { success: `Ran ${t.rules.length} rule(s): ${done} action(s) done, ${failed} failed; ${t.missedFollowUps} follow-up(s) marked missed.` };
  } catch (e) { return fail(e); }
}
