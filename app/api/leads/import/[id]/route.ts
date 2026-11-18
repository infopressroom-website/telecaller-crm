import { ok, route } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/session";
import { getBatchProgress } from "@/services/import-service";

export const dynamic = "force-dynamic";

export const GET = route<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireApiPermission("lead", "CREATE");
  return ok(await getBatchProgress(user, params.id));
});
