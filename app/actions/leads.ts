"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { updateLeadScore } from "@/lib/lead-scoring-trigger";
import {
  addNote, bulkAssign, bulkStatus, changeStatus, createLead, deleteView, mergeLeads, saveView, updateLead,
} from "@/services/lead-service";
import {
  bulkAssignSchema, bulkStatusSchema, leadInputSchema, mergeSchema, noteSchema, parseLeadListQuery, savedViewNameSchema, statusSchema,
} from "@/validations/lead";
import type { FormState } from "./auth";

const fields = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function createLeadAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = leadInputSchema.safeParse(fields(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  let id: string;
  try {
    const result = await createLead(user, parsed.data, fd.get("confirmDuplicate") === "on");
    if (!result.ok) {
      const { total, visible } = result.duplicate;
      const names = visible.map((v) => `${v.leadCode} (${v.name})`).join(", ");
      return {
        needsConfirm: true,
        error: `A lead with this mobile number already exists${names ? `: ${names}` : ` (${total}, outside your access)`}. Tick “Create anyway” to add it as a separate record.`,
      };
    }
    id = result.id;
  } catch (e) {
    return fail(e);
  }
  redirect(`/leads/${id}`);
}

export async function updateLeadAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(fd.get("leadId") ?? "");
  const parsed = leadInputSchema.safeParse(fields(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await updateLead(user, id, parsed.data);
    // Auto-recalculate lead score after update
    updateLeadScore(id).catch(console.error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${id}`);
  return { success: "Saved." };
}

export async function changeStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: "Choose a valid status." };
  try {
    await changeStatus(user, parsed.data.leadId, parsed.data.status);
    // Auto-recalculate lead score after status change
    updateLeadScore(parsed.data.leadId).catch(console.error);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Status updated." };
}

export async function addNoteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(fields(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await addNote(user, parsed.data.leadId, parsed.data.message);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Note added." };
}

export async function bulkAssignAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = bulkAssignSchema.safeParse({ ids: fd.getAll("ids").map(String), ownerId: fd.get("ownerId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your selection." };
  try {
    const r = await bulkAssign(user, parsed.data.ids, parsed.data.ownerId, String(fd.get("reason") ?? ""));
    revalidatePath("/leads");
    const parts = [`Assigned ${r.assigned} lead${r.assigned === 1 ? "" : "s"}`];
    if (r.requested) parts.push(`${r.requested} sent for approval`);
    if (r.skipped) parts.push(`${r.skipped} skipped (already with that person, already requested, or outside your access)`);
    return { success: `${parts.join("; ")}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = bulkStatusSchema.safeParse({ ids: fd.getAll("ids").map(String), status: fd.get("status") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your selection." };
  try {
    const r = await bulkStatus(user, parsed.data.ids, parsed.data.status);
    revalidatePath("/leads");
    return { success: `Updated ${r.updated} lead${r.updated === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} unchanged or outside your access)` : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function mergeLeadsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = mergeSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: "Invalid merge request." };
  if (fd.get("confirm") !== "on") return { error: "Tick the box to confirm the merge." };
  try {
    await mergeLeads(user, parsed.data.targetId, parsed.data.sourceId);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/${parsed.data.targetId}`);
  return { success: "Duplicate merged. Its history now appears on this lead." };
}

export async function saveViewAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = savedViewNameSchema.safeParse(fd.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Name the view." };
  try {
    await saveView(user, name.data, parseLeadListQuery(JSON.parse(String(fd.get("query") ?? "{}"))));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/leads");
  return { success: "View saved." };
}

export async function deleteViewAction(fd: FormData) {
  const user = await requireUser();
  await deleteView(user, String(fd.get("id") ?? ""));
  revalidatePath("/leads");
}
