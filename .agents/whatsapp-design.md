# WhatsApp Integration - Technical Design Document

## Overview

This document specifies the complete WhatsApp messaging integration for Telecaller CRM using Meta's WhatsApp Business Cloud API. The design follows the existing telephony provider pattern: a provider interface abstraction, a Meta implementation, service-layer business logic with RBAC enforcement, API routes for client interaction, webhook ingestion for incoming messages, and UI components for chat interface. The integration enables bidirectional messaging (send templates and text messages, receive incoming messages), template management, conversation history, message status tracking (sent/delivered/read), and seamless integration with the lead timeline and notification systems.

**Architecture decision:** WhatsApp follows the telephony integration pattern with `lib/whatsapp/` for provider abstraction, `services/whatsapp-service.ts` for business logic, and graceful degradation when credentials are not configured. This maintains consistency with the existing codebase and allows future providers (Twilio, WATI) to be added without touching business logic.

**Technology stack:** Next.js 14 API routes, Prisma ORM with PostgreSQL, Meta WhatsApp Business Cloud API v18.0, TypeScript, server-side validation with Zod, existing Pusher integration for real-time message delivery, existing notification system for in-app alerts.

## Database Schema

### New Models

#### WhatsAppMessage
Stores all WhatsApp messages (inbound and outbound), similar to CallLog for telephony.

```prisma
enum WhatsAppMessageDirection {
  INBOUND
  OUTBOUND
}

enum WhatsAppMessageType {
  TEXT
  TEMPLATE
  IMAGE
  DOCUMENT
  LOCATION
  REACTION
}

enum WhatsAppMessageStatus {
  PENDING     // Queued, not yet sent
  SENT        // Accepted by Meta
  DELIVERED   // Delivered to customer's device
  READ        // Customer opened the message
  FAILED      // Send failed or expired
}

model WhatsAppMessage {
  id             String                      @id @default(cuid())
  leadId         String
  lead           Lead                        @relation(fields: [leadId], references: [id])
  agentId        String?                     // null for inbound messages from customer
  agent          User?                       @relation(fields: [agentId], references: [id])
  direction      WhatsAppMessageDirection
  messageType    WhatsAppMessageType
  content        String?                     // text content or caption
  status         WhatsAppMessageStatus       @default(PENDING)
  externalId     String?                     // WhatsApp message ID (wamid)
  templateName   String?                     // for template messages
  templateParams Json?                       // variable substitution values
  mediaUrl       String?                     // for image/document messages
  mediaId        String?                     // Meta media ID
  metadata       Json?                       // raw Meta API response, contact info, location coords
  failureReason  String?                     // error message from Meta
  dedupeKey      String?                     @unique // webhook deduplication
  createdAt      DateTime                    @default(now())
  updatedAt      DateTime                    @updatedAt

  @@index([leadId, createdAt])
  @@index([status, createdAt])
  @@index([externalId])
  @@index([direction, status, createdAt(sort: Desc)])
}
```

**Design decision:** `agentId` is nullable because inbound messages originate from customers. The `dedupeKey` follows the telephony pattern: it prevents duplicate processing of webhook events. `metadata` stores the raw Meta response for debugging and future feature extraction (e.g., context, referral info).

#### WhatsAppTemplate
Caches approved templates from Meta API, refreshed periodically.

```prisma
enum WhatsAppTemplateStatus {
  APPROVED
  PENDING
  REJECTED
  DELETED
}

enum WhatsAppTemplateCategory {
  MARKETING
  UTILITY
  AUTHENTICATION
}

model WhatsAppTemplate {
  id          String                     @id @default(cuid())
  externalId  String                     @unique // Meta template ID
  name        String                     // template name used in API calls
  category    WhatsAppTemplateCategory
  language    String                     // e.g., "en_US", "hi"
  status      WhatsAppTemplateStatus
  content     Json                       // template structure (components: header, body, footer, buttons)
  variables   String[]                   // extracted variable names like {{1}}, {{2}}
  createdAt   DateTime                   @default(now())
  updatedAt   DateTime                   @updatedAt

  @@unique([name, language])
  @@index([status, category])
}
```

**Design decision:** Templates are cached locally to avoid repeated Meta API calls during UI rendering. The `content` JSON field stores the complete template structure returned by Meta (header, body, footer, buttons) for preview rendering. The `variables` array is extracted from the body text to simplify the send-template form.

#### WhatsAppWebhookEvent
Append-only log of all incoming webhooks, similar to CallEvent for telephony.

```prisma
enum WhatsAppWebhookStatus {
  RECEIVED
  PROCESSED
  IGNORED
  FAILED
}

model WhatsAppWebhookEvent {
  id           String                 @id @default(cuid())
  dedupeKey    String                 @unique // prevents duplicate processing
  eventType    String                 // "message", "status", "unknown"
  raw          Json                   // complete webhook payload
  normalized   Json?                  // extracted business data
  status       WhatsAppWebhookStatus  @default(RECEIVED)
  attempts     Int                    @default(0)
  messageId    String?                // links to WhatsAppMessage.id after processing
  note         String?                // error message or skip reason
  receivedAt   DateTime               @default(now())
  processedAt  DateTime?

  @@index([status, receivedAt])
  @@index([eventType, status])
}
```

**Design decision:** Store first, process second. This pattern (copied from telephony) makes webhooks idempotent and allows failed events to be retried without asking Meta to resend. The `dedupeKey` is constructed from Meta's message ID or status update ID.

### Schema Extensions

#### Lead Model
Add WhatsApp messages relationship.

```prisma
model Lead {
  // ... existing fields ...
  whatsappMessages WhatsAppMessage[]
}
```

#### User Model
Add WhatsApp messages relationship.

```prisma
model User {
  // ... existing fields ...
  whatsappMessages WhatsAppMessage[]
}
```

#### LeadActivityType Enum
Add WhatsApp message activity type.

```prisma
enum LeadActivityType {
  // ... existing types ...
  WHATSAPP_MESSAGE
}
```

**Design decision:** WhatsApp messages appear in the lead timeline as `WHATSAPP_MESSAGE` activities, following the pattern of call logs and notes.

#### NotificationChannel Enum
Already includes `WHATSAPP` (currently unused). No changes needed.

**Design decision:** The existing notification system already reserved the WHATSAPP channel but never implemented it. This integration will enable it for incoming message notifications.

## Service Layer

### lib/whatsapp/provider.ts
Provider-neutral interface for WhatsApp integrations.

```typescript
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
```

**Design decision:** The interface abstracts Meta-specific details so Twilio or other providers can be added later. The `customField` allows our message ID to travel to Meta and return in webhooks, enabling correlation. The `dedupeKey` prevents duplicate webhook processing.

### lib/whatsapp/meta.ts
Meta WhatsApp Business Cloud API implementation.

```typescript
import "server-only";
import type { WhatsAppProvider, WhatsAppMessageInput, WhatsAppSendResult, WhatsAppProviderError } from "./provider";

export type MetaCredentials = {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
};

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly key = "meta";
  readonly label = "Meta WhatsApp Business";
  private readonly baseUrl = "https://graph.facebook.com/v18.0";

  constructor(private readonly creds: MetaCredentials) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.creds.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async sendMessage(input: WhatsAppMessageInput): Promise<WhatsAppSendResult> {
    const url = `${this.baseUrl}/${this.creds.phoneNumberId}/messages`;
    
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to.replace(/\D/g, ""), // Meta expects digits only
    };

    if (input.type === "text") {
      body.type = "text";
      body.text = { body: input.text, preview_url: true };
    } else if (input.type === "template") {
      body.type = "template";
      body.template = {
        name: input.templateName,
        language: { code: input.templateLanguage || "en_US" },
        components: input.templateParams
          ? [
              {
                type: "body",
                parameters: input.templateParams.map((value) => ({
                  type: "text",
                  text: value,
                })),
              },
            ]
          : [],
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error?.message || "Unknown error";
        if (res.status === 401 || res.status === 403) {
          throw new WhatsAppProviderError(
            `Meta rejected credentials: ${errorMessage}`,
            "rejected"
          );
        }
        if (res.status === 429) {
          throw new WhatsAppProviderError(
            "Rate limit exceeded. Try again later.",
            "rate_limited"
          );
        }
        if (res.status === 400) {
          throw new WhatsAppProviderError(
            `Invalid request: ${errorMessage}`,
            "invalid_template"
          );
        }
        throw new WhatsAppProviderError(
          `Meta API error (${res.status}): ${errorMessage}`,
          "unreachable"
        );
      }

      return {
        externalId: data.messages?.[0]?.id || "",
        status: "sent",
      };
    } catch (error) {
      if (error instanceof WhatsAppProviderError) throw error;
      throw new WhatsAppProviderError(
        "Could not reach Meta WhatsApp API",
        "unreachable"
      );
    }
  }

  async testCredentials(): Promise<{ ok: boolean; message: string }> {
    const url = `${this.baseUrl}/${this.creds.phoneNumberId}?fields=display_phone_number,verified_name`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          message: "Meta rejected the access token. Check credentials.",
        };
      }

      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          message: `Connected to ${data.verified_name} (${data.display_phone_number})`,
        };
      }

      return {
        ok: false,
        message: `Meta API returned HTTP ${res.status}`,
      };
    } catch {
      return {
        ok: false,
        message: "Could not reach Meta API. Check network and credentials.",
      };
    }
  }

  async listTemplates() {
    const url = `${this.baseUrl}/${this.creds.businessAccountId}/message_templates?fields=id,name,category,language,status,components&limit=250`;
    
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new WhatsAppProviderError(
          `Could not fetch templates (HTTP ${res.status})`,
          "unreachable"
        );
      }

      const data = await res.json();
      return (data.data || []).map((t: any) => ({
        externalId: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        status: t.status,
        content: t.components || [],
      }));
    } catch (error) {
      if (error instanceof WhatsAppProviderError) throw error;
      throw new WhatsAppProviderError(
        "Could not fetch templates from Meta",
        "unreachable"
      );
    }
  }

  async getMediaUrl(mediaId: string): Promise<string | null> {
    const url = `${this.baseUrl}/${mediaId}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data.url || null;
    } catch {
      return null;
    }
  }
}
```

**Design decision:** The implementation handles Meta's specific JSON structure (messaging_product, recipient_type, template components). Template variables are mapped to Meta's `parameters` array format. Error codes are mapped to provider error kinds for consistent handling in the service layer. The phone number is normalized to digits-only as Meta rejects E.164 format with + prefix.

**Edge case handling:**
- Rate limiting (429): throw rate_limited error, caller backs off
- Invalid template (400): throw invalid_template, user sees actionable error
- Network timeout: throw unreachable, retry allowed
- Missing credentials: constructor not called, registry returns unconfigured error

### lib/whatsapp/registry.ts
Provider selection and initialization.

```typescript
import "server-only";
import { AppError } from "@/lib/errors";
import { MetaWhatsAppProvider, type MetaCredentials } from "./meta";
import type { WhatsAppProvider } from "./provider";

export type WhatsAppSettings = {
  enabled: boolean;
  provider: "meta" | null;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  verifyToken: string;
};

export async function getWhatsAppProvider(
  settings: WhatsAppSettings
): Promise<WhatsAppProvider | null> {
  if (!settings.enabled || !settings.provider) return null;

  if (settings.provider === "meta") {
    if (
      !settings.phoneNumberId ||
      !settings.accessToken ||
      !settings.businessAccountId
    ) {
      throw new AppError(
        "INTERNAL_ERROR",
        "WhatsApp is enabled but Meta credentials are incomplete. Check Settings → WhatsApp."
      );
    }

    const creds: MetaCredentials = {
      phoneNumberId: settings.phoneNumberId,
      accessToken: settings.accessToken,
      businessAccountId: settings.businessAccountId,
    };

    return new MetaWhatsAppProvider(creds);
  }

  return null;
}

export function isWhatsAppConfigured(settings: WhatsAppSettings): boolean {
  return (
    settings.enabled &&
    settings.provider === "meta" &&
    !!settings.phoneNumberId &&
    !!settings.accessToken &&
    !!settings.businessAccountId
  );
}
```

**Design decision:** Returns `null` when WhatsApp is not configured, allowing graceful degradation throughout the application. Settings are stored in the database `Setting` table, not environment variables, because they need to be changed without redeployment (following the telephony pattern where only secrets are in environment variables).

**Correction:** Actually, following the telephony pattern more closely, credentials should be in environment variables (never in database) and only configuration toggles (enabled, webhook URL) should be in database. This is more secure. Revised decision: credentials come from environment variables (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`), settings table stores only `enabled: boolean`.

### lib/whatsapp/config.ts
Configuration and environment variable reading.

```typescript
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
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "dev-secret";
  return `${appUrl}/api/whatsapp/webhook/${verifyToken}`;
}
```

**Design decision:** Credentials live only in server environment variables and are never stored in the database or sent to the client. The verify token is part of the webhook URL path (following Meta's pattern), not a header. Settings table stores only the enabled flag, which can be toggled by admins without redeployment.

### lib/whatsapp/security.ts
Webhook signature verification.

```typescript
import "server-only";
import { createHmac } from "node:crypto";
import { constantTimeEqual } from "@/lib/telephony/security";

/**
 * Verifies Meta WhatsApp webhook signature.
 * Meta sends X-Hub-Signature-256: sha256=<hex-encoded-hmac>
 * The HMAC is computed over the raw request body with the App Secret.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const receivedSignature = parts[1]!.trim();
  const expectedSignature = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  return constantTimeEqual(expectedSignature, receivedSignature);
}
```

**Design decision:** Meta uses HMAC-SHA256 with hex encoding and sends it as `X-Hub-Signature-256: sha256=<signature>`. This differs from Exotel's pattern. The app secret for HMAC should be stored in `WHATSAPP_APP_SECRET` environment variable. Constant-time comparison prevents timing attacks.

**Correction:** Meta WhatsApp Cloud API webhooks use the verify token for initial subscription verification (GET request) but do NOT use HMAC signatures for webhook payloads. Signature verification is optional and not documented for Cloud API. We'll implement verify token validation only.

### services/whatsapp-service.ts
Business logic and RBAC enforcement.

```typescript
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { AppError, notFound } from "@/lib/errors";
import { getWhatsAppSettings } from "@/lib/whatsapp/config";
import { MetaWhatsAppProvider } from "@/lib/whatsapp/meta";
import { WhatsAppProviderError, type NormalizedWhatsAppEvent } from "@/lib/whatsapp/provider";
import { getAccessibleLead } from "./scope-service";
import { notify } from "./notification-service";
import { normalizeMobile } from "@/validations/common";

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
  } catch (error) {
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
  } catch (error) {
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

  // Find lead by phone number
  const normalized = normalizeMobile(event.from);
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
  const statusPriority = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 99 };
  const currentPriority = statusPriority[message.status] || 0;
  const newPriority = statusPriority[event.status?.toUpperCase() as keyof typeof statusPriority] || 0;

  if (newPriority > currentPriority) {
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: event.status?.toUpperCase() as any,
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
```

**Design decision:** The service layer enforces RBAC, creates database records before calling the provider (following the telephony pattern), and handles errors by marking records as failed. Webhook ingestion is idempotent via `dedupeKey`. Incoming messages create notifications for lead owners. Status updates only progress forward (sent → delivered → read), never backward.

**Error handling:**
- WhatsApp not configured: AppError CONFLICT with user-friendly message pointing to settings
- Provider unreachable: WhatsAppProviderError caught, message marked failed, AppError thrown to user
- Unknown lead for incoming message: webhook marked IGNORED, no error thrown
- Duplicate webhook: return early with `duplicate: true`, acknowledge to Meta

**Validation:**
- Phone numbers: validated via `normalizeMobile()`, converted to E.164
- Text content: truncated to Meta's 4096 character limit
- Template parameters: passed as-is, Meta validates against template definition

## API Routes

### POST /api/whatsapp/send
Send text message to lead.

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { sendWhatsAppText } from "@/services/whatsapp-service";

const schema = z.object({
  leadId: z.string().cuid(),
  text: z.string().min(1).max(4096),
});

export const POST = route(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const body = await req.json();
  const { leadId, text } = schema.parse(body);

  const messageId = await sendWhatsAppText(user, leadId, text);

  return ok({ messageId });
});
```

### POST /api/whatsapp/templates/send
Send template message to lead.

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { sendWhatsAppTemplate } from "@/services/whatsapp-service";

const schema = z.object({
  leadId: z.string().cuid(),
  templateName: z.string(),
  templateLanguage: z.string().default("en_US"),
  params: z.array(z.string()).default([]),
});

export const POST = route(async (req: NextRequest) => {
  const user = await getCurrentUser();
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
```

### GET /api/whatsapp/messages/[leadId]
Fetch conversation history.

```typescript
import { NextRequest } from "next/server";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { getWhatsAppHistory } from "@/services/whatsapp-service";

export const GET = route(
  async (req: NextRequest, { params }: { params: { leadId: string } }) => {
    const user = await getCurrentUser();
    const messages = await getWhatsAppHistory(user, params.leadId);

    return ok({ messages });
  }
);
```

### POST /api/whatsapp/webhook/[verifyToken]
Webhook endpoint for Meta callbacks.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/api";
import { ingestWhatsAppWebhook } from "@/services/whatsapp-service";
import { parseMetaWebhook } from "@/lib/whatsapp/meta-parse";

/**
 * Meta WhatsApp webhook handler.
 * GET: Webhook verification (Meta subscription setup)
 * POST: Incoming messages and status updates
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { verifyToken: string } }
) {
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export const POST = route(
  async (req: NextRequest, { params }: { params: { verifyToken: string } }) => {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

    if (params.verifyToken !== expectedToken) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const raw = await req.json();
    const events = parseMetaWebhook(raw);

    for (const event of events) {
      await ingestWhatsAppWebhook(event, raw);
    }

    return new NextResponse("OK", { status: 200 });
  }
);
```

**Design decision:** The webhook URL includes the verify token as a path parameter (Meta's subscription setup requires it). GET handles subscription verification, POST handles message/status webhooks. All events are processed synchronously before responding to Meta (guarantees ordering). Meta expects 200 response within 20 seconds.

### lib/whatsapp/meta-parse.ts
Webhook payload parser.

```typescript
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
```

**Design decision:** Meta sends batched webhooks with multiple messages/statuses. Each is normalized to a separate event. The `dedupeKey` for status updates includes the status type (sent/delivered/read) because Meta sends separate webhooks for each status change for the same message. Timestamp is Unix epoch in seconds, converted to Date.

### GET /api/whatsapp/templates
List approved templates.

```typescript
import { NextRequest } from "next/server";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { listApprovedTemplates } from "@/services/whatsapp-service";

export const GET = route(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const templates = await listApprovedTemplates(user);

  return ok({ templates });
});
```

### POST /api/whatsapp/templates/sync
Refresh templates from Meta API (admin only).

```typescript
import { NextRequest } from "next/server";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { syncWhatsAppTemplates } from "@/services/whatsapp-service";

export const POST = route(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const synced = await syncWhatsAppTemplates(user);

  return ok({ synced });
});
```

## UI Components

### features/whatsapp/whatsapp-chat.tsx
Main chat interface component for lead detail page.

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { MessageComposer } from "./message-composer";
import { MessageBubble } from "./message-bubble";
import { TemplateSelector } from "./template-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: string;
  content: string | null;
  status: string;
  templateName: string | null;
  mediaUrl: string | null;
  createdAt: string;
  agent: { name: string } | null;
};

type Props = {
  leadId: string;
  leadName: string;
};

export function WhatsAppChat({ leadId, leadName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${leadId}`);
      const json = await res.json();
      if (json.data) {
        setMessages(json.data.messages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(text: string) {
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, text }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to send");
      }

      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTemplate(
    templateName: string,
    templateLanguage: string,
    params: string[]
  ) {
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/templates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, templateName, templateLanguage, params }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to send");
      }

      setShowTemplates(false);
      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send template");
    } finally {
      setSending(false);
    }
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  return (
    <Card className="flex h-[600px] flex-col">
      <div className="border-b p-4">
        <h3 className="font-semibold">WhatsApp Chat with {leadName}</h3>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-muted">
            No messages yet. Start the conversation with a template.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      <div className="border-t p-4">
        {showTemplates ? (
          <TemplateSelector
            onSelect={handleSendTemplate}
            onCancel={() => setShowTemplates(false)}
            disabled={sending}
          />
        ) : (
          <div className="space-y-2">
            <MessageComposer onSend={handleSend} disabled={sending} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(true)}
              disabled={sending}
            >
              Send Template
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
```

**Design decision:** The chat interface is a self-contained component that fetches its own data and handles sending. It scrolls to bottom on new messages. Template selector is shown inline when requested. Loading and error states are handled locally with user feedback.

### features/whatsapp/message-bubble.tsx
Individual message display.

```typescript
"use client";

import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  message: {
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    messageType: string;
    content: string | null;
    status: string;
    templateName: string | null;
    createdAt: string;
    agent: { name: string } | null;
  };
};

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === "OUTBOUND";
  const time = new Date(message.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2",
          isOutbound
            ? "bg-blue-500 text-white"
            : "bg-slate-100 text-ink-base"
        )}
      >
        {message.templateName && (
          <div className="mb-1 text-xs opacity-75">
            Template: {message.templateName}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {message.content || "(media)"}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-xs opacity-75">
          <span>{time}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "READ") {
    return <CheckCheck className="h-4 w-4 text-blue-200" />;
  }
  if (status === "DELIVERED") {
    return <CheckCheck className="h-4 w-4" />;
  }
  if (status === "SENT") {
    return <Check className="h-4 w-4" />;
  }
  return null;
}
```

**Design decision:** WhatsApp-style status indicators: single check for sent, double check for delivered, double check in blue for read. Inbound messages are left-aligned with gray background, outbound messages are right-aligned with blue background. Template messages show template name above content.

### features/whatsapp/message-composer.tsx
Text input form.

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

type Props = {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
};

export function MessageComposer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;

    const message = text.trim();
    setText("");
    await onSend(message);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        rows={2}
        className="flex-1 resize-none"
      />
      <Button type="submit" disabled={!text.trim() || disabled} size="icon">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
```

**Design decision:** Enter sends, Shift+Enter adds line break (standard chat UX). Send button is disabled when input is empty or sending is in progress.

### features/whatsapp/template-selector.tsx
Template picker with variable input.

```typescript
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type Template = {
  id: string;
  name: string;
  category: string;
  language: string;
  content: any;
  variables: string[];
};

type Props = {
  onSelect: (templateName: string, language: string, params: string[]) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
};

export function TemplateSelector({ onSelect, onCancel, disabled }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selected) {
      setParams(Array(selected.variables.length).fill(""));
    }
  }, [selected]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data.templates);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!selected || disabled) return;

    await onSelect(selected.name, selected.language, params);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Template</Label>
        <Select
          value={selected?.id}
          onValueChange={(id) => setSelected(templates.find((t) => t.id === id) || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.category})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && selected.variables.length > 0 && (
        <div className="space-y-2">
          <Label>Variables</Label>
          {selected.variables.map((variable, index) => (
            <Input
              key={index}
              placeholder={`Variable ${index + 1}`}
              value={params[index] || ""}
              onChange={(e) => {
                const newParams = [...params];
                newParams[index] = e.target.value;
                setParams(newParams);
              }}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSend} disabled={!selected || disabled}>
          Send Template
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

**Design decision:** Templates are grouped by category in the dropdown. When a template is selected, the UI renders input fields for each variable ({{1}}, {{2}}, etc.). The send button is disabled until a template is selected. Variables are optional (some templates have none).

### app/(app)/settings/whatsapp/page.tsx
Settings page for WhatsApp configuration.

```typescript
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getWhatsAppSettings, webhookUrl } from "@/lib/whatsapp/config";
import { ConfigForm } from "@/features/settings/whatsapp-forms";

export const metadata: Metadata = { title: "WhatsApp Settings" };
export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const user = await requirePagePermission("settings", "MANAGE");
  const settings = await getWhatsAppSettings();

  const hasCredentials = !!settings.credentials;
  const isEnabled = settings.enabled;
  const status = isEnabled && hasCredentials ? "active" : hasCredentials ? "ready" : "unconfigured";

  return (
    <>
      <PageHeader
        title="WhatsApp Integration"
        description="Connect Meta WhatsApp Business API for bidirectional messaging with leads."
      />

      <Card>
        <h2 className="mb-2 text-base font-semibold">Status</h2>
        <Badge tone={status === "active" ? "success" : status === "ready" ? "neutral" : "danger"}>
          {status === "active" ? "Active" : status === "ready" ? "Ready (disabled)" : "Not configured"}
        </Badge>

        {!hasCredentials && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
            <p className="font-semibold">Setup Required</p>
            <p className="mt-1">
              Add the following environment variables to the server:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-xs">
              <li>WHATSAPP_PHONE_NUMBER_ID</li>
              <li>WHATSAPP_ACCESS_TOKEN</li>
              <li>WHATSAPP_BUSINESS_ACCOUNT_ID</li>
              <li>WHATSAPP_VERIFY_TOKEN (24+ characters, you choose this)</li>
            </ul>
            <p className="mt-2">
              Get these from{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Meta for Developers
              </a>
              . Restart the server after adding them.
            </p>
          </div>
        )}

        {hasCredentials && (
          <div className="mt-3 text-sm text-ink-muted">
            Credentials detected. Configure webhook in Meta dashboard.
          </div>
        )}
      </Card>

      {hasCredentials && (
        <>
          <Card>
            <h2 className="mb-3 text-base font-semibold">Webhook Configuration</h2>
            <p className="text-sm">
              In Meta for Developers → WhatsApp → Configuration → Webhook, set:
            </p>
            <div className="mt-2">
              <Label>Callback URL</Label>
              <code className="mt-1 block break-all rounded bg-slate-100 p-2 text-xs">
                {webhookUrl()}
              </code>
            </div>
            <div className="mt-3">
              <Label>Verify Token</Label>
              <p className="text-sm text-ink-muted">
                Use the value of <code>WHATSAPP_VERIFY_TOKEN</code> (not shown here for security).
              </p>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Subscribe to webhook fields: <strong>messages</strong> and <strong>message_status</strong>.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold">Enable/Disable</h2>
            <ConfigForm enabled={isEnabled} />
          </Card>
        </>
      )}
    </Card>
    </>
  );
}
```

**Design decision:** Settings page is admin-only (settings:MANAGE permission). Credentials are NEVER shown (they live only in environment variables). The page displays setup instructions when credentials are missing, webhook configuration when credentials are present, and an enable/disable toggle. The verify token is part of the webhook URL but not displayed in plaintext.

### features/settings/whatsapp-forms.tsx
Enable/disable form and test credentials button.

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function ConfigForm({ enabled }: { enabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setIsEnabled(checked);
    } catch (error) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={saving}
        id="whatsapp-enabled"
      />
      <Label htmlFor="whatsapp-enabled">
        Enable WhatsApp messaging
        {saving && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}
      </Label>
    </div>
  );
}

export function TestCredentialsButton() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp/test-credentials", {
        method: "POST",
      });

      const json = await res.json();
      setResult(json.data);
    } catch (error) {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <Button onClick={handleTest} disabled={testing}>
        {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Test Credentials
      </Button>
      {result && (
        <div className={`mt-2 text-sm ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
```

## Integration Points

### 1. Lead Detail Page
Add WhatsApp tab to existing lead detail tabs (Call, Activity, Notes).

**File:** `app/(app)/leads/[id]/page.tsx`

Add tab:
```typescript
<Tab value="whatsapp">WhatsApp</Tab>
```

Add tab panel:
```typescript
{activeTab === "whatsapp" && (
  <WhatsAppChat leadId={lead.id} leadName={lead.name} />
)}
```

**Design decision:** WhatsApp chat is a tab alongside existing tabs, not a modal or separate page. This maintains consistency with call logs and activities.

### 2. Lead List
Show last WhatsApp message timestamp and preview in lead rows.

**File:** `app/(app)/leads/page.tsx`

Query extension in `services/lead-service.ts`:
```typescript
const lastWhatsAppMessage = await db.whatsAppMessage.findFirst({
  where: { leadId: lead.id },
  orderBy: { createdAt: "desc" },
  select: { content: true, createdAt: true, direction: true },
});
```

Display in lead row:
```typescript
{lead.lastWhatsAppMessage && (
  <div className="text-xs text-ink-muted">
    <span className="font-semibold">WhatsApp:</span>{" "}
    {lead.lastWhatsAppMessage.content?.slice(0, 50)}...{" "}
    {formatDistanceToNow(new Date(lead.lastWhatsAppMessage.createdAt), { addSuffix: true })}
  </div>
)}
```

### 3. Automation Rules
Add "Send WhatsApp Template" action to automation system.

**File:** `services/automation-service.ts`

Add action handler:
```typescript
case "send_whatsapp_template": {
  const { templateName, templateLanguage, params } = action;
  await sendWhatsAppTemplate(
    systemUser, // automation runs as system
    entityId, // leadId
    templateName,
    templateLanguage,
    params
  );
  break;
}
```

**Design decision:** Only template messages are allowed in automation (text messages require 24-hour conversation window). The automation UI includes template selector with variable mapping.

### 4. Notifications
Enable WHATSAPP channel in existing notification system.

**Already implemented in service layer** (`processIncomingMessage` creates notifications for lead owners). No additional changes needed.

### 5. Real-time Updates
Use existing Pusher integration for new message notifications.

**File:** `lib/pusher-server.ts`

Add event type:
```typescript
export const RealtimeEvents = {
  // ... existing events ...
  WHATSAPP_MESSAGE_RECEIVED: "whatsapp:message_received",
  WHATSAPP_MESSAGE_SENT: "whatsapp:message_sent",
} as const;
```

Trigger in service layer after saving message:
```typescript
await notifyUser(lead.ownerId, RealtimeEvents.WHATSAPP_MESSAGE_RECEIVED, {
  messageId: message.id,
  leadId: lead.id,
  preview: text?.slice(0, 100),
});
```

**Client-side listener** in `features/whatsapp/whatsapp-chat.tsx`:
```typescript
useEffect(() => {
  if (!pusherClient) return;

  const channel = pusherClient.subscribe(`private-user-${userId}`);
  channel.bind(RealtimeEvents.WHATSAPP_MESSAGE_RECEIVED, () => {
    loadMessages(); // refresh chat
  });

  return () => {
    channel.unbind_all();
    channel.unsubscribe();
  };
}, [userId]);
```

**Design decision:** Real-time updates are optional (graceful degradation if Pusher not configured). Messages are fetched on mount and refreshed on Pusher events.

### 6. Timeline Integration
WhatsApp messages already appear in lead timeline via `LeadActivity` entries created in service layer. No additional changes needed.

**Display:** `features/leads/lead-timeline.tsx` already renders `WHATSAPP_MESSAGE` activities based on the `type` field.

## Webhook Handling

### Verification Flow (GET)
Meta sends GET request during subscription setup:
```
GET /api/whatsapp/webhook/{verifyToken}?hub.mode=subscribe&hub.verify_token={token}&hub.challenge={challenge}
```

Response: Echo back the challenge if tokens match.

### Message Flow (POST)
1. Meta sends POST to webhook URL with message data
2. Route validates verify token in URL path
3. Raw payload parsed by `parseMetaWebhook()`
4. For each event, call `ingestWhatsAppWebhook()`
5. Webhook stored in database with dedupeKey
6. If duplicate, return 200 immediately
7. Process event: create WhatsAppMessage, LeadActivity, Notification
8. Mark webhook as PROCESSED
9. Return 200 to Meta within 20 seconds

**Error handling:**
- Unknown lead: webhook marked IGNORED, return 200
- Unknown message ID (status update): webhook marked IGNORED, return 200
- Database error: webhook marked FAILED, return 500 (Meta will retry)
- Duplicate: return 200 immediately without processing

**Deduplication:** `dedupeKey` format is `whatsapp:message:{messageId}` for messages and `whatsapp:status:{messageId}:{status}` for status updates. This prevents processing the same webhook twice if Meta retries.

**Idempotency:** Webhooks are stored before processing. Failed webhooks can be retried from the database without asking Meta to resend.

### Retry Logic
Admin page (similar to telephony webhook health):
```typescript
// File: services/whatsapp-service.ts
export async function retryFailedWhatsAppWebhooks(user: AuthUser): Promise<number> {
  assertCan(user, "settings", "MANAGE");

  const failed = await db.whatsAppWebhookEvent.findMany({
    where: { status: "FAILED", attempts: { lt: 3 } },
    take: 100,
  });

  let retried = 0;
  for (const event of failed) {
    try {
      const normalized = event.normalized as NormalizedWhatsAppEvent;
      if (normalized.eventType === "message") {
        await processIncomingMessage(normalized);
      } else if (normalized.eventType === "status") {
        await processStatusUpdate(normalized);
      }

      await db.whatsAppWebhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });

      retried++;
    } catch (error) {
      await db.whatsAppWebhookEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          note: error instanceof Error ? error.message.slice(0, 500) : "Retry failed",
        },
      });
    }
  }

  return retried;
}
```

## Testing Strategy

### Unit Tests
**File:** `__tests__/services/whatsapp-service.test.ts`

Test cases:
- `sendWhatsAppText()`: RBAC enforcement, message creation, provider call, error handling
- `sendWhatsAppTemplate()`: template parameter passing, failure marking
- `ingestWhatsAppWebhook()`: deduplication, unknown lead handling, notification creation
- `processStatusUpdate()`: status priority ordering, unknown message handling
- `extractTemplateVariables()`: variable extraction from template body

**File:** `__tests__/lib/whatsapp/meta.test.ts`

Test cases:
- `MetaWhatsAppProvider.sendMessage()`: API request formatting, error mapping
- `parseMetaWebhook()`: batch parsing, timestamp conversion, dedupeKey generation

### Integration Tests
**File:** `__tests__/integration/whatsapp.test.ts`

Test cases:
- End-to-end message send: create message, call provider, save to database, create activity
- Webhook ingestion: receive webhook, create message, create notification, link to lead
- Template sync: fetch from Meta, upsert to database, extract variables

### Manual Testing Checklist
1. Configure credentials in environment
2. Enable WhatsApp in settings
3. Test credentials button → verify connection
4. Configure webhook in Meta dashboard
5. Send test message from Meta dashboard → verify webhook received
6. Send text message from CRM → verify appears in chat
7. Send template message → verify variables substituted
8. Reply from WhatsApp → verify appears in chat, notification sent
9. Check message status updates (delivered, read)
10. Verify timeline shows WhatsApp activities
11. Test with unknown phone number → verify ignored gracefully
12. Test with credentials missing → verify graceful error messages

## Environment Variables

Add to `lib/env.ts`:

```typescript
const envSchema = z.object({
  // ... existing fields ...

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal("")),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().or(z.literal("")),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().or(z.literal("")),
  WHATSAPP_VERIFY_TOKEN: z.string().min(24).optional().or(z.literal("")),
});
```

**Design decision:** All WhatsApp credentials are optional (graceful degradation). The verify token must be at least 24 characters for security. Access token is a long-lived token generated in Meta for Developers.

## Migration

Prisma migration file `prisma/migrations/YYYYMMDDHHMMSS_add_whatsapp/migration.sql`:

```sql
-- WhatsApp message direction enum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- WhatsApp message type enum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT', 'TEMPLATE', 'IMAGE', 'DOCUMENT', 'LOCATION', 'REACTION');

-- WhatsApp message status enum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- WhatsApp template status enum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'DELETED');

-- WhatsApp template category enum
CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- WhatsApp webhook status enum
CREATE TYPE "WhatsAppWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- WhatsAppMessage table
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agentId" TEXT,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "messageType" "WhatsAppMessageType" NOT NULL,
    "content" TEXT,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "templateName" TEXT,
    "templateParams" JSONB,
    "mediaUrl" TEXT,
    "mediaId" TEXT,
    "metadata" JSONB,
    "failureReason" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppMessage_dedupeKey_key" ON "WhatsAppMessage"("dedupeKey");
CREATE INDEX "WhatsAppMessage_leadId_createdAt_idx" ON "WhatsAppMessage"("leadId", "createdAt");
CREATE INDEX "WhatsAppMessage_status_createdAt_idx" ON "WhatsAppMessage"("status", "createdAt");
CREATE INDEX "WhatsAppMessage_externalId_idx" ON "WhatsAppMessage"("externalId");
CREATE INDEX "WhatsAppMessage_direction_status_createdAt_idx" ON "WhatsAppMessage"("direction", "status", "createdAt" DESC);

ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WhatsAppTemplate table
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "WhatsAppTemplateCategory" NOT NULL,
    "language" TEXT NOT NULL,
    "status" "WhatsAppTemplateStatus" NOT NULL,
    "content" JSONB NOT NULL,
    "variables" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppTemplate_externalId_key" ON "WhatsAppTemplate"("externalId");
CREATE UNIQUE INDEX "WhatsAppTemplate_name_language_key" ON "WhatsAppTemplate"("name", "language");
CREATE INDEX "WhatsAppTemplate_status_category_idx" ON "WhatsAppTemplate"("status", "category");

-- WhatsAppWebhookEvent table
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "normalized" JSONB,
    "status" "WhatsAppWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "messageId" TEXT,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppWebhookEvent_dedupeKey_key" ON "WhatsAppWebhookEvent"("dedupeKey");
CREATE INDEX "WhatsAppWebhookEvent_status_receivedAt_idx" ON "WhatsAppWebhookEvent"("status", "receivedAt");
CREATE INDEX "WhatsAppWebhookEvent_eventType_status_idx" ON "WhatsAppWebhookEvent"("eventType", "status");

-- Extend LeadActivityType enum
ALTER TYPE "LeadActivityType" ADD VALUE 'WHATSAPP_MESSAGE';
```

**Design decision:** All indexes match the query patterns in the service layer. The `dedupeKey` unique constraints enforce idempotency at the database level. Foreign keys use `ON DELETE SET NULL` for agents (messages persist when agent is deleted) and `ON DELETE RESTRICT` for leads (messages cannot be orphaned).

---

## Summary

This design delivers a production-ready WhatsApp integration following the existing telephony pattern: provider abstraction, service-layer business logic with RBAC, webhook ingestion with idempotency, and UI components for chat interface. The integration is complete with bidirectional messaging, template support, status tracking, timeline integration, and graceful degradation when credentials are not configured.

**Key architectural decisions:**
1. Credentials in environment variables (never in database)
2. Provider interface allows future additions (Twilio, WATI)
3. Webhooks stored before processing (idempotency + retry)
4. Status updates only progress forward (sent → delivered → read)
5. Incoming messages create notifications for lead owners
6. Real-time updates via existing Pusher integration (optional)
7. Template sync refreshed manually and via cron
8. RBAC reuses existing lead permissions (WhatsApp is lead communication)

**Files to create:** 21 new files (provider layer, service layer, API routes, UI components, settings page)

**Files to modify:** 4 existing files (schema.prisma, env.ts, lead detail page, automation service)

**Database changes:** 3 new tables, 6 new enums, 1 enum extension

**Environment variables:** 4 new variables (all optional for graceful degradation)
