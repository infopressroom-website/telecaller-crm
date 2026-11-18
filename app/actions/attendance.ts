"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { assignShift, clockIn, clockOut, endBreak, markRange, saveShift, startBreak } from "@/services/attendance-service";
import { leaveSchema, shiftSchema } from "@/validations/team";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function clockAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const op = String(fd.get("op"));
  try {
    if (op === "in") await clockIn(user);
    else if (op === "out") await clockOut(user);
    else if (op === "break_start") await startBreak(user);
    else if (op === "break_end") await endBreak(user);
    else return { error: "Unknown action." };
  } catch (e) { return fail(e); }
  revalidatePath("/attendance");
  return { success: { in: "Clocked in. Have a good day!", out: "Clocked out. See you tomorrow.", break_start: "Break started.", break_end: "Welcome back." }[op] };
}

export async function markLeaveAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = leaveSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  try {
    const r = await markRange(user, p.data);
    revalidatePath("/attendance");
    return { success: `Marked ${r.changed} day(s)${r.kept ? `; ${r.kept} day(s) with a real clock-in were left unchanged` : ""}.` };
  } catch (e) { return fail(e); }
}

export async function saveShiftAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = shiftSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the shift." };
  try { await saveShift(user, p.data, String(fd.get("id") ?? "") || undefined); } catch (e) { return fail(e); }
  revalidatePath("/attendance/shifts");
  return { success: "Saved." };
}

export async function assignShiftAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try { await assignShift(user, String(fd.get("userId") ?? ""), String(fd.get("shiftId") ?? "")); } catch (e) { return fail(e); }
  revalidatePath("/attendance/shifts");
  return { success: "Shift assigned from now on." };
}
