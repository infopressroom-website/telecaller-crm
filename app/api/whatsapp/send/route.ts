import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { sendWhatsAppText } from "@/services/whatsapp-service";

const schema = z.object({
  leadId: z.string().cuid(),
  text: z.string().min(1).max(4096),
});

export const POST = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  const body = await req.json();
  const { leadId, text } = schema.parse(body);

  const messageId = await sendWhatsAppText(user, leadId, text);

  return ok({ messageId });
});
