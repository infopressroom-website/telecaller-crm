"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { saveCallSchema, startCallSchema } from "@/validations/workspace";
import { completeCall, startCall } from "@/services/workspace-service";

export type StartResult = { ok: true; startedAt: string; mode: "manual" | "live" | "sandbox" } | { ok: false; error: string };
export type SaveResult =
  | { ok: true; alreadySaved: boolean; outcome?: string; newStatus?: string | null; followUpAt?: string | null }
  | { ok: false; error: string };

function message(e: unknown) {
  if (e instanceof AppError) return e.message;
  console.error(e);
  return "Something went wrong on our side. Your notes are kept on this screen; please try saving again.";
}

export async function startCallAction(input: unknown): Promise<StartResult> {
  const user = await requireUser();
  const parsed = startCallSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    return { ok: true, ...(await startCall(user, parsed.data.leadId, parsed.data.callRef)) };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function saveCallAction(input: unknown): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = saveCallSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  try {
    const r = await completeCall(user, parsed.data);
    revalidatePath("/workspace");
    revalidatePath(`/workspace/lead/${parsed.data.leadId}`);
    return r.alreadySaved ? { ok: true, alreadySaved: true } : { ok: true, alreadySaved: false, outcome: r.outcome, newStatus: r.newStatus ?? null, followUpAt: r.followUpAt };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
