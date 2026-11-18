"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { ratingsSchema } from "@/lib/qa/scorecard";
import { analyseCall, reviewAnalysis, saveTranscript, setAiEnabled } from "@/services/ai-service";
import { createReview } from "@/services/qa-service";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function createReviewAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const callId = String(fd.get("callId") ?? "");
  const ratings = ratingsSchema.safeParse(Object.fromEntries(fd));
  if (!ratings.success) return { error: ratings.error.issues[0]?.message ?? "Rate every criterion." };
  try { await createReview(user, callId, ratings.data, String(fd.get("feedback") ?? "").trim().slice(0, 2000), String(fd.get("coachingNotes") ?? "").trim().slice(0, 2000)); } catch (e) { return fail(e); }
  revalidatePath("/qa");
  redirect("/qa");
}

export async function saveTranscriptAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const callId = String(fd.get("callId") ?? "");
  try { await saveTranscript(user, callId, String(fd.get("text") ?? "")); } catch (e) { return fail(e); }
  revalidatePath(`/qa/review/${callId}`);
  return { success: "Transcript saved." };
}

export async function analyseCallAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const callId = String(fd.get("callId") ?? "");
  try { await analyseCall(user, callId); } catch (e) { return fail(e); }
  revalidatePath(`/qa/review/${callId}`);
  return { success: "Analysis ready below. Please review it before using it." };
}

export async function reviewAnalysisAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try { await reviewAnalysis(user, String(fd.get("id") ?? ""), fd.get("op") === "accept"); } catch (e) { return fail(e); }
  revalidatePath(`/qa/review/${String(fd.get("callId") ?? "")}`);
  return { success: "Recorded." };
}

export async function setAiEnabledAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try { await setAiEnabled(user, fd.get("enabled") === "on", fd.get("ack") === "on"); } catch (e) { return fail(e); }
  revalidatePath("/settings/ai");
  return { success: "Saved." };
}
