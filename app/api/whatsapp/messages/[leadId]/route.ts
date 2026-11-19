import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getWhatsAppHistory } from "@/services/whatsapp-service";

export const GET = route(
  async (req: Request, { params }: { params: { leadId: string } }) => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
    
    const messages = await getWhatsAppHistory(user, params.leadId);

    return ok({ messages });
  }
);
