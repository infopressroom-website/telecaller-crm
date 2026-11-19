import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors";
import { getWhatsAppSettings } from "@/lib/whatsapp/config";
import { MetaWhatsAppProvider } from "@/lib/whatsapp/meta";
import { WhatsAppProviderError, type NormalizedWhatsAppEvent } from "@/lib/whatsapp/provider";
import { getAccessibleLead } from "./scope-service";
import { notify } from "./notification-service";

/**
 * Sends a text message to a lead. RBAC: requires lead:CREATE permission.
 * Returns message ID. Throws AppError if WhatsApp not configured or send fails.
 */
export async function sendWhatsAppText(
  user: AuthUser,
  leadId: string,
  text: string
): Promise<string> {
  assertCan(user, "lead", "CREATE"); // reusing lead permission; WhatsApp is lead communication
  
  const lead = await getAccessibleLead(user, leadId);
  
  const settings = await getWhatsAppSettings();
  if (!settings.enabled || !settings.credentials) {
    throw new AppError(
      "CONFLICT",
      "WhatsApp messaging is not configured. Ask an administrator to set it up in Settings → WhatsApp."
    );
  }

  const provider = new MetaWhatsAppProvider(settings.credentials);
  
  // Create message record first (status: PENDING)
  const message = await db.whatsAppMessage.create({
    data: {
      leadId,
      agentId: user.id,
      direction: "OUTBOUND",
      messageType: "TEXT",
      content: text.slice(0, 4096), // Meta's limit
      status: "PENDING",
    },
  });

  try {
    const result = await provider.sendMessage({
      to: lead.primaryMobile, // already in E.164
      type: "text",
      text,
      customField: message.id,
    });

    // Update message with external ID and status
    await db.$transaction([
      db.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          externalId: result.externalId,
          status: "SENT",
          metadata: { sentAt: new Date().toISOString() },
        },
      }),
      db.leadActivity.create({
        data: {
          leadId,
          type: "WHATSAPP_MESSAGE",
          actorId: user.id,
          message: `Sent WhatsApp message: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`,
          data: { messageId: message.id, direction: "OUTBOUND" },
        },
      }),
    ]);

    return message.id;
  } catch (error) {
    // Mark message as failed
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        failureReason:
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });

    if (error instanceof WhatsAppProviderError) {
      throw new AppError("CONFLICT", error.message);
    }
    throw error;
  }
}

/**
 * Sends a template message (required for first message in 24-hour window).
 */
export async function sendWhatsAppTemplate(
  user: AuthUser,
  leadId: string,
  templateName: string,
  templateLanguage: string,
  params: string[]
): Promise<string> {
  assertCan(user, "lead", "CREATE");
  
  const lead = await getAccessibleLead(user, leadId);
  
  const settings = await getWhatsAppSettings();
  if (!settings.enabled || !settings.credentials) {
    throw new AppError("CONFLICT", "WhatsApp messaging is not configured.");
  }

  const provider = new MetaWhatsAppProvider(settings.credentials);
  
  const message = await db.whatsAppMessage.create({
    data: {
      leadId,
      agentId: user.id,
      direction: "OUTBOUND",
      messageType: "TEMPLATE",
      templateName,
      templateParams: params,
      status: "PENDING",
    },
  });

  try {
    const result = await provider.sendMessage({
      to: lead.primaryMobile,
      type: "template",
      templateName,
      templateLanguage,
      templateParams: params,
      customField: message.id,
    });

    await db.$transaction([
      db.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          externalId: result.externalId,
          status: "SENT",
        },
      }),
      db.leadActivity.create({
        data: {
          leadId,
          type: "WHATSAPP_MESSAGE",
          actorId: user.id,
          message: `Sent WhatsApp template: ${templateName}`,
          data: { messageId: message.id, direction: "OUTBOUND", templateName },
        },
      }),
    ]);

    return message.id;
  } catch (error) {
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        failureReason:
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });

    if (error instanceof WhatsAppProviderError) {
      throw new AppError("CONFLICT", error.message);
    }
    throw error;
  }
}

/**
 * Fetches conversation history for a lead. RBAC: requires lead:VIEW permission.
 */
export async function getWhatsAppHistory(
  user: AuthUser,
  leadId: string,
  limit = 50
) {
  assertCan(user, "lead", "VIEW");
  
  const lead = await getAccessibleLead(user, leadId);

  const messages = await db.whatsAppMessage.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      direction: true,
      messageType: true,
      content: true,
      status: true,
      templateName: true,
      mediaUrl: true,
      createdAt: true,
      agent: {
        select: { name: true },
      },
    },
  });

  return messages.reverse(); // oldest first for chat display
}

/**
 * Processes incoming webhook events (messages and status updates).
 * Called by the webhook API route. Idempotent via dedupeKey.
 */
export async function ingestWhatsAppWebhook(
  event: NormalizedWhatsAppEvent,
  raw: unknown
): Promise<{ duplicate: boolean }> {
  // Store raw event first
  let webhookEvent;
  try {
    webhookEvent = await db.whatsAppWebhookEvent.create({
      data: {
        dedupeKey: event.dedupeKey,
        eventType: event.eventType,
        raw: raw as Prisma.InputJsonValue,
        normalized: event as unknown as Prisma.InputJsonValue,
        status: "RECEIVED",
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Duplicate webhook, acknowledge and ignore
      return { duplicate: true };
    }
    throw error;
  }

  // Process the event
  try {
    if (event.eventType === "message") {
      await processIncomingMessage(event);
    } else if (event.eventType === "status") {
      await processStatusUpdate(event);
    }

    await db.whatsAppWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    return { duplicate: false };
  } catch (error: unknown) {
    await db.whatsAppWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        note: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });
    throw error;
  }
}

async function processIncomingMessage(event: NormalizedWhatsAppEvent) {
  if (!event.from) {
    throw new Error("Incoming message has no sender phone number");
  }

  // Find lead by phone number - normalize to E.164
  const normalized = event.from.startsWith("+") ? event.from : `+${event.from}`;
  const lead = await db.lead.findFirst({
    where: {
      OR: [
        { primaryMobile: normalized },
        { alternateMobile: normalized },
      ],
    },
    select: { id: true, name: true, ownerId: true },
  });

  if (!lead) {
    // Unknown sender, log and ignore
    await db.whatsAppWebhookEvent.update({
      where: { dedupeKey: event.dedupeKey },
      data: {
        status: "IGNORED",
        note: `No lead found for phone number ${event.from}`,
      },
    });
    return;
  }

  // Create inbound message
  const message = await db.whatsAppMessage.create({
    data: {
      leadId: lead.id,
      direction: "INBOUND",
      messageType: event.messageType === "text" ? "TEXT" : (event.messageType?.toUpperCase() as any) || "TEXT",
      content: event.text || null,
      status: "DELIVERED", // inbound messages are already delivered
      externalId: event.externalId,
      mediaId: event.mediaId || null,
      metadata: event.metadata as Prisma.InputJsonValue,
      dedupeKey: event.dedupeKey,
    },
  });

  // Add to lead timeline
  await db.leadActivity.create({
    data: {
      leadId: lead.id,
      type: "WHATSAPP_MESSAGE",
      message: `Received WhatsApp message: "${(event.text || "").slice(0, 100)}${(event.text?.length || 0) > 100 ? "..." : ""}"`,
      data: { messageId: message.id, direction: "INBOUND" },
    },
  });

  // Notify lead owner
  if (lead.ownerId) {
    await notify({
      userId: lead.ownerId,
      title: `WhatsApp from ${lead.name}`,
      body: event.text?.slice(0, 200) || "(media message)",
      link: `/leads/${lead.id}?tab=whatsapp`,
      dedupeKey: `whatsapp:${message.id}`,
    });
  }

  // Link webhook to message
  await db.whatsAppWebhookEvent.update({
    where: { dedupeKey: event.dedupeKey },
    data: { messageId: message.id },
  });
}

async function processStatusUpdate(event: NormalizedWhatsAppEvent) {
  if (!event.externalId) {
    throw new Error("Status update has no message ID");
  }

  const message = await db.whatsAppMessage.findFirst({
    where: { externalId: event.externalId },
  });

  if (!message) {
    // Status update for unknown message (test message, or message sent outside CRM)
    await db.whatsAppWebhookEvent.update({
      where: { dedupeKey: event.dedupeKey },
      data: {
        status: "IGNORED",
        note: `No message found for external ID ${event.externalId}`,
      },
    });
    return;
  }

  // Update message status (only if progressing forward)
  const statusPriority: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 99 };
  const currentPriority = statusPriority[message.status] || 0;
  const newStatus = event.status?.toUpperCase() || "";
  const newPriority = statusPriority[newStatus] || 0;

  if (newPriority > currentPriority) {
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: newStatus as any,
        updatedAt: new Date(),
      },
    });
  }

  // Link webhook to message
  await db.whatsAppWebhookEvent.update({
    where: { dedupeKey: event.dedupeKey },
    data: { messageId: message.id },
  });
}

/**
 * Refreshes templates from Meta API and caches them locally.
 * Called by settings page and periodically by cron.
 */
export async function syncWhatsAppTemplates(user: AuthUser): Promise<number> {
  assertCan(user, "settings", "MANAGE");

  const settings = await getWhatsAppSettings();
  if (!settings.enabled || !settings.credentials) {
    throw new AppError("CONFLICT", "WhatsApp is not configured.");
  }

  const provider = new MetaWhatsAppProvider(settings.credentials);
  const templates = await provider.listTemplates();

  let synced = 0;
  for (const template of templates) {
    // Extract variables from body component
    const bodyComponent = (template.content as any[]).find((c: any) => c.type === "BODY");
    const bodyText = bodyComponent?.text || "";
    const variables = extractTemplateVariables(bodyText);

    await db.whatsAppTemplate.upsert({
      where: { externalId: template.externalId },
      update: {
        name: template.name,
        category: template.category.toUpperCase() as any,
        language: template.language,
        status: template.status.toUpperCase() as any,
        content: template.content as Prisma.InputJsonValue,
        variables,
        updatedAt: new Date(),
      },
      create: {
        externalId: template.externalId,
        name: template.name,
        category: template.category.toUpperCase() as any,
        language: template.language,
        status: template.status.toUpperCase() as any,
        content: template.content as Prisma.InputJsonValue,
        variables,
      },
    });
    synced++;
  }

  return synced;
}

function extractTemplateVariables(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, ""));
}

/**
 * Lists approved templates for sending.
 */
export async function listApprovedTemplates(user: AuthUser) {
  assertCan(user, "lead", "VIEW");

  return db.whatsAppTemplate.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      language: true,
      content: true,
      variables: true,
    },
  });
}
