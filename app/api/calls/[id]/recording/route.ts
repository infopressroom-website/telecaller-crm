import { route } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/session";
import { recordingUrlFor } from "@/services/call-service";

export const dynamic = "force-dynamic";

// Permission + scope are checked, the access is audited, then the browser is sent to the provider's recording link.
export const GET = route<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireApiPermission("call", "VIEW");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const url = await recordingUrlFor(user, params.id, ip);
  return Response.redirect(url, 302);
});
