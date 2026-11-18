"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertCan } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  applyDistribution, archiveRule, decideRequest, saveAgentSettings, saveRule, setRuleActive, type RunSummary,
} from "@/services/distribution-service";
import { saveDistributionSettings } from "@/services/settings-service";
import { agentSettingsSchema, decisionSchema, ruleSchema, runSchema, settingsSchema } from "@/validations/distribution";
import type { FormState } from "./auth";

export type RunState = (FormState & { summary?: RunSummary }) | undefined;

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}
const raw = (fd: FormData) => Object.fromEntries(fd) as Record<string, unknown>;

export async function applyDistributionAction(_prev: RunState, fd: FormData): Promise<RunState> {
  const user = await requireUser();
  const parsed = runSchema.safeParse(raw(fd));
  if (!parsed.success) return { error: "Invalid request. Reload the page and try again." };
  try {
    const summary = await applyDistribution(user, parsed.data.runId, parsed.data.mode);
    revalidatePath("/distribution");
    revalidatePath("/leads");
    return { success: summary.alreadyApplied ? "This run was already applied; showing its result." : "Distribution applied.", summary };
  } catch (e) {
    return fail(e);
  }
}

function ruleFields(fd: FormData) {
  return { ...raw(fd), agentIds: fd.getAll("agentIds").map(String), fallbackToAny: fd.get("fallbackToAny") === "on", isActive: fd.get("isActive") === "on" };
}

export async function saveRuleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ruleSchema.safeParse(ruleFields(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, error: "Please fix the highlighted fields." };
  const id = String(fd.get("ruleId") ?? "") || null;
  try {
    await saveRule(user, id, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/distribution/rules");
  redirect("/distribution/rules");
}

export async function toggleRuleAction(fd: FormData) {
  const user = await requireUser();
  await setRuleActive(user, String(fd.get("id") ?? ""), fd.get("isActive") === "true");
  revalidatePath("/distribution/rules");
}

export async function archiveRuleAction(fd: FormData) {
  const user = await requireUser();
  await archiveRule(user, String(fd.get("id") ?? ""));
  revalidatePath("/distribution/rules");
}

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(raw(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    assertCan(user, "distribution", "MANAGE");
    await saveDistributionSettings(parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/distribution");
  return { success: "Saved." };
}

export async function saveAgentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = agentSettingsSchema.safeParse({ ...raw(fd), assignmentPaused: fd.get("assignmentPaused") === "on" });
  if (!parsed.success) return { error: "Limits must be whole numbers of at least 1." };
  try {
    await saveAgentSettings(user, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/distribution/agents");
  return { success: "Saved." };
}

export async function decideRequestAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse(raw(fd));
  if (!parsed.success) return { error: "Invalid decision." };
  try {
    const r = await decideRequest(user, parsed.data.id, parsed.data.decision === "approve", parsed.data.note);
    revalidatePath("/distribution/approvals");
    return { success: r.message };
  } catch (e) {
    revalidatePath("/distribution/approvals");
    return fail(e);
  }
}

