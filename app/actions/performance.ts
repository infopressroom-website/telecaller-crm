"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { approveStatement, generateStatements, markStatementPaid, rejectStatement, saveIncentiveSettings, saveSlab } from "@/services/incentive-service";
import { deleteTarget, saveTarget } from "@/services/performance-service";
import { slabSchema, targetSchema } from "@/validations/team";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}
const raw = (fd: FormData) => Object.fromEntries(fd) as Record<string, unknown>;

export async function saveTargetAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = targetSchema.safeParse(raw(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the target." };
  try { await saveTarget(user, p.data); } catch (e) { return fail(e); }
  revalidatePath("/performance/targets");
  return { success: "Target saved." };
}
export async function deleteTargetAction(fd: FormData) {
  const user = await requireUser();
  await deleteTarget(user, String(fd.get("id") ?? ""));
  revalidatePath("/performance/targets");
}

export async function saveSlabAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = slabSchema.safeParse({ ...raw(fd), isActive: fd.get("isActive") === "on" });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the slab." };
  try { await saveSlab(user, p.data); } catch (e) { return fail(e); }
  revalidatePath("/performance/incentives");
  return { success: "Saved." };
}

export async function saveBonusAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const v = Number(fd.get("bonus"));
  if (!Number.isFinite(v) || v < 0 || v > 1_000_000) return { error: "Enter an amount in rupees." };
  try { await saveIncentiveSettings(user, v); } catch (e) { return fail(e); }
  revalidatePath("/performance/incentives");
  return { success: "Saved." };
}

export async function generateIncentivesAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const from = String(fd.get("from") ?? ""), to = String(fd.get("to") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "Choose both dates." };
  try {
    const r = await generateStatements(user, from, to);
    revalidatePath("/performance/incentives");
    return { success: `${r.created} statement(s) created for approval; ${r.skipped} skipped (already exists or nothing earned).` };
  } catch (e) { return fail(e); }
}

export async function decideIncentiveAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(fd.get("id") ?? ""), op = String(fd.get("op"));
  try {
    if (op === "approve") await approveStatement(user, id);
    else if (op === "reject") await rejectStatement(user, id);
    else if (op === "paid") await markStatementPaid(user, id);
    else return { error: "Unknown action." };
  } catch (e) { revalidatePath("/performance/incentives"); return fail(e); }
  revalidatePath("/performance/incentives");
  return { success: "Done." };
}
