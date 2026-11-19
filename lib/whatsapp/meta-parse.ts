import type { NormalizedWhatsAppEvent } from "./provider";

/**
 * Parses Meta WhatsApp webhook payload into normalized events.
 * Meta sends batched events: multiple messages/statuses in one webhook.
 */
export function parseMetaWebhook(raw: any): NormalizedWhatsAppEvent[] {
  const events: NormalizedWhatsAppEvent[] = [];

  try {
    const entries = raw.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};

        // Process messages
        const messages = value.messages || [];
        for (const message of messages) {
          events.push({
            provider: "meta",
            eventType: "message",
            externalId: message.id,
            from: message.from,
            to: value.metadata?.display_phone_number,
            messageType: message.type,
            text: message.text?.body,
            mediaId: message.image?.id || message.document?.id,
            caption: message.image?.caption || message.document?.caption,
            location:
              message.location?.latitude && message.location?.longitude
                ? {
                    latitude: message.location.latitude,
                    longitude: message.location.longitude,
                  }
                : undefined,
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            dedupeKey: `whatsapp:message:${message.id}`,
            metadata: {
              context: message.context,
              referral: message.referral,
            },
          });
        }

        // Process status updates
        const statuses = value.statuses || [];
        for (const status of statuses) {
          events.push({
            provider: "meta",
            eventType: "status",
            externalId: status.id,
            status: status.status, // "sent", "delivered", "read", "failed"
            timestamp: new Date(parseInt(status.timestamp) * 1000),
            dedupeKey: `whatsapp:status:${status.id}:${status.status}`,
            metadata: {
              recipientId: status.recipient_id,
              errors: status.errors,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Failed to parse Meta webhook:", error);
  }

  return events;
}
