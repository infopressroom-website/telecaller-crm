import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { listApprovedTemplates } from "@/services/whatsapp-service";

export const GET = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  const templates = await listApprovedTemplates(user);

  return ok({ templates });
});
