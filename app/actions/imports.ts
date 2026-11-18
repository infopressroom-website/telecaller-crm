"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { IMPORT_FIELD_KEYS } from "@/lib/leads/fields";
import type { Mapping } from "@/lib/leads/import-mapping";
import { resetToMapping, runImport, validateBatch } from "@/services/import-service";
import type { FormState } from "./auth";

const idSchema = z.string().min(1).max(40);

function fail(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function validateImportAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = idSchema.safeParse(fd.get("batchId"));
  if (!id.success) return { error: "Invalid import." };
  const mapping: Mapping = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("map:")) continue;
    const field = String(v);
    mapping[k.slice(4)] = (IMPORT_FIELD_KEYS as string[]).includes(field) ? (field as Mapping[string]) : "";
  }
  try {
    await validateBatch(user, id.data, mapping);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/leads/import/${id.data}`);
  return { success: "Checked." };
}

export async function backToMappingAction(fd: FormData) {
  const user = await requireUser();
  const id = idSchema.parse(fd.get("batchId"));
  await resetToMapping(user, id);
  revalidatePath(`/leads/import/${id}`);
}

export async function runImportAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = idSchema.safeParse(fd.get("batchId"));
  const strategy = z.enum(["UPDATE", "SKIP", "KEEP_SEPARATE"]).safeParse(fd.get("strategy"));
  if (!id.success || !strategy.success) return { error: "Choose what to do with duplicates." };
  try {
    await runImport(user, id.data, strategy.data);
  } catch (e) {
    revalidatePath(`/leads/import/${id.data}`);
    return fail(e);
  }
  revalidatePath(`/leads/import/${id.data}`);
  return { success: "Import finished." };
}
