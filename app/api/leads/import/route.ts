import { ok, route } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { MAX_FILE_BYTES, parseUpload } from "@/lib/leads/parse-file";
import { createBatch } from "@/services/import-service";

export const dynamic = "force-dynamic";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : undefined);

export const POST = route(async (req) => {
  const user = await requireApiPermission("lead", "CREATE");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new AppError("VALIDATION_ERROR", "Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) throw new AppError("VALIDATION_ERROR", "The file is larger than 5 MB.");
  const parsed = await parseUpload(file.name, Buffer.from(await file.arrayBuffer()));
  const id = await createBatch(user, { name: file.name, size: file.size }, parsed, { campaignId: text(form.get("campaignId")), sourceId: text(form.get("sourceId")) });
  return ok({ id }, { status: 201 });
});
