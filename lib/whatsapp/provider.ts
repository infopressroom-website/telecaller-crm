import "server-only";

export type WhatsAppMessageInput = {
  to: string; // E.164 format: +919876543210
  type: "text" | "template";
  text?: string; // for text messages
  templateName?: string; // for template messages
  templateLanguage?: string; // "en_US", "hi", etc.
  templateParams?: string[]; // variable values in order
  customField?: string; // our message ID echoed back in webhooks
};

export type WhatsAppSendResult = {
  externalId: string; // WhatsApp message ID (wamid)
  status: string; // "sent", "queued", etc.
};

export type NormalizedWhatsAppEvent = {
  provider: string;
  eventType: "message" | "status" | "unknown";
  externalId: string; // wamid
  from?: string; // sender phone number
  to?: string; // recipient phone number
  messageType?: "text" | "image" | "document" | "location" | "reaction";
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  location?: { latitude: number; longitude: number };
  status?: "sent" | "delivered" | "read" | "failed";
  timestamp: Date;
  dedupeKey: string;
  customField?: string; // our message ID
  metadata?: Record<string, unknown>;
};

export class WhatsAppProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "rejected" | "unreachable" | "rate_limited" | "invalid_template" | "unconfigured"
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}

export interface WhatsAppProvider {
  readonly key: string;
  readonly label: string;
  sendMessage(input: WhatsAppMessageInput): Promise<WhatsAppSendResult>;
  testCredentials(): Promise<{ ok: boolean; message: string }>;
  listTemplates(): Promise<Array<{
    externalId: string;
    name: string;
    category: string;
    language: string;
    status: string;
    content: unknown;
  }>>;
  getMediaUrl(mediaId: string): Promise<string | null>;
}
