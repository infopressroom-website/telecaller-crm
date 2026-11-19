import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { assertCan } from "@/lib/auth/rbac";
import { setWhatsAppEnabled } from "@/lib/whatsapp/config";

const schema = z.object({
  enabled: z.boolean(),
});

export const POST = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  assertCan(user, "settings", "MANAGE");
  
  const body = await req.json();
  const { enabled } = schema.parse(body);

  await setWhatsAppEnabled(enabled);

  return ok({ success: true });
});
