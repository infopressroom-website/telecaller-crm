import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/rbac";
import { getWhatsAppSettings } from "@/lib/whatsapp/config";
import { MetaWhatsAppProvider } from "@/lib/whatsapp/meta";
import { AppError } from "@/lib/errors";

export const POST = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  assertCan(user, "settings", "MANAGE");

  const settings = await getWhatsAppSettings();
  if (!settings.credentials) {
    throw new AppError("CONFLICT", "WhatsApp credentials not configured");
  }

  const provider = new MetaWhatsAppProvider(settings.credentials);
  const result = await provider.testCredentials();

  return ok(result);
});
