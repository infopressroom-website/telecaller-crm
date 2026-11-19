import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { sendWhatsAppTemplate } from "@/services/whatsapp-service";

const schema = z.object({
  leadId: z.string().cuid(),
  templateName: z.string(),
  templateLanguage: z.string().default("en_US"),
  params: z.array(z.string()).default([]),
});

export const POST = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  const body = await req.json();
  const { leadId, templateName, templateLanguage, params } = schema.parse(body);

  const messageId = await sendWhatsAppTemplate(
    user,
    leadId,
    templateName,
    templateLanguage,
    params
  );

  return ok({ messageId });
});
