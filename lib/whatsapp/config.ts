import "server-only";
import { db } from "@/lib/db";

export type WhatsAppCredentials = {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  verifyToken: string;
};

export function getWhatsAppCredentials(): WhatsAppCredentials | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

  if (!phoneNumberId || !accessToken || !businessAccountId || !verifyToken) {
    return null;
  }

  return { phoneNumberId, accessToken, businessAccountId, verifyToken };
}

export async function getWhatsAppSettings() {
  const setting = await db.setting.findUnique({
    where: { key: "whatsapp" },
  });

  const enabled = (setting?.value as { enabled?: boolean })?.enabled ?? false;

  return {
    enabled,
    credentials: getWhatsAppCredentials(),
  };
}

export async function setWhatsAppEnabled(enabled: boolean) {
  await db.setting.upsert({
    where: { key: "whatsapp" },
    update: { value: { enabled } },
    create: { key: "whatsapp", value: { enabled } },
  });
}

export function webhookUrl(): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/whatsapp/webhook`;
}
