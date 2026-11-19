import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { syncWhatsAppTemplates } from "@/services/whatsapp-service";

export const POST = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  const synced = await syncWhatsAppTemplates(user);

  return ok({ synced });
});
