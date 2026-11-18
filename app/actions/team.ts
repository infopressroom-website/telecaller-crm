"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createEmployee, resetEmployeePassword, saveTeam, unlockEmployee, updateEmployee } from "@/services/employee-service";
import { employeeSchema, teamSchema } from "@/validations/team";
import type { FormState } from "./auth";

export type EmployeeState = (FormState & { tempPassword?: string; email?: string }) | undefined;

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}
const raw = (fd: FormData) => Object.fromEntries(fd) as Record<string, unknown>;

export async function createEmployeeAction(_p: EmployeeState, fd: FormData): Promise<EmployeeState> {
  const user = await requireUser();
  const parsed = employeeSchema.safeParse(raw(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, error: "Please fix the highlighted fields." };
  try {
    const r = await createEmployee(user, parsed.data);
    revalidatePath("/team");
    return { success: "Employee created.", tempPassword: r.tempPassword, email: parsed.data.email };
  } catch (e) { return fail(e); }
}

export async function updateEmployeeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = employeeSchema.safeParse(raw(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, error: "Please fix the highlighted fields." };
  const id = String(fd.get("id") ?? "");
  try { await updateEmployee(user, id, parsed.data); } catch (e) { return fail(e); }
  revalidatePath("/team"); revalidatePath(`/team/${id}`);
  return { success: "Saved." };
}

export async function resetPasswordAction(_p: EmployeeState, fd: FormData): Promise<EmployeeState> {
  const user = await requireUser();
  try {
    const r = await resetEmployeePassword(user, String(fd.get("id") ?? ""));
    return { success: "Password reset. All their sessions were signed out.", tempPassword: r.tempPassword };
  } catch (e) { return fail(e); }
}

export async function unlockEmployeeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try { await unlockEmployee(user, String(fd.get("id") ?? "")); } catch (e) { return fail(e); }
  revalidatePath("/team");
  return { success: "Account unlocked." };
}

export async function saveTeamAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = teamSchema.safeParse(raw(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the team." };
  try { await saveTeam(user, String(fd.get("id") ?? "") || null, parsed.data); } catch (e) { return fail(e); }
  revalidatePath("/team/teams");
  return { success: "Saved." };
}
