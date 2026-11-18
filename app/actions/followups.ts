"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { completeFollowUp, createFollowUp, rescheduleFollowUp } from "@/services/followup-service";
import type { FormState } from "./auth";

const id = z.string().min(1).max(40);
// <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" with no zone; staff work in India time.
const istDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).transform((v) => new Date(`${v}:00+05:30`)).refine((d) => !Number.isNaN(d.getTime()), "Enter a valid date and time");

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function completeFollowUpAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const i = id.safeParse(fd.get("id"));
  if (!i.success) return { error: "Invalid follow-up." };
  try { await completeFollowUp(user, i.data); } catch (e) { return fail(e); }
  revalidatePath("/follow-ups"); revalidatePath("/workspace");
  return { success: "Marked done." };
}

export async function rescheduleFollowUpAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = z.object({ id, dueLocal: istDateTime, reason: z.string().trim().max(200).default("") }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the date and time." };
  try { await rescheduleFollowUp(user, p.data.id, p.data.dueLocal, p.data.reason); } catch (e) { return fail(e); }
  revalidatePath("/follow-ups"); revalidatePath("/workspace");
  return { success: "Rescheduled." };
}

export async function createFollowUpAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = z.object({ leadId: id, dueLocal: istDateTime, notes: z.string().trim().max(300).default("") }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the date and time." };
  try { await createFollowUp(user, p.data.leadId, p.data.dueLocal, p.data.notes); } catch (e) { return fail(e); }
  revalidatePath(`/leads/${p.data.leadId}`); revalidatePath("/follow-ups");
  return { success: "Follow-up scheduled." };
}
