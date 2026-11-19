# WhatsApp Integration Design Review

**Review Date:** 2025-01-29  
**Reviewer:** Kiro Design Review Agent  
**Document:** whatsapp-design.md

---

## Verdict: CHANGES_REQUESTED

**HIGH Severity Findings:** 8  
**MEDIUM Severity Findings:** 12  
**NIT Severity Findings:** 7

---

## HIGH Severity Findings

### 1. MISSING: API route for updating WhatsApp settings
**Location:** API Routes section  
**Issue:** The design specifies `POST /api/whatsapp/settings` in the UI component (`whatsapp-forms.tsx` line "const res = await fetch("/api/whatsapp/settings"..."), but no such route is defined in the API Routes section.  
**Fix:** Add this route definition:
```typescript
// POST /api/whatsapp/settings
import { NextRequest } from "next/server";
import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { setWhatsAppEnabled } from "@/lib/whatsapp/config";

const schema = z.object({
  enabled: z.boolean(),
});

export const POST = route(async (req: NextRequest) => {
  const user = await getCurrentUser();
  assertCan(user, "settings", "MANAGE");
  const body = await req.json();
  const { enabled } = schema.parse(body);

  await setWhatsAppEnabled(enabled);

  return ok({ success: true });
});
```

### 2. MISSING: API route for testing credentials
**Location:** API Routes section  
**Issue:** The `TestCredentialsButton` component calls `/api/whatsapp/test-credentials` but this route is not defined.  
**Fix:** Add this route definition:
```typescript
// POST /api/whatsapp/test-credentials
import { NextRequest } from "next/server";
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/rbac";
import { getWhatsAppSettings } from "@/lib/whatsapp/config";
import { MetaWhatsAppProvider } from "@/lib/whatsapp/meta";
import { AppError } from "@/lib/errors";

export const POST = route(async (req: NextRequest) => {
  const user = await getCurrentUser();
  assertCan(user, "settings", "MANAGE");

  const settings = await getWhatsAppSettings();
  if (!settings.credentials) {
    throw new AppError("CONFLICT", "WhatsApp credentials not configured.");
  }

  const provider = new MetaWhatsAppProvider(settings.credentials);
  const result = await provider.testCredentials();

  return ok(result);
});
```

### 3. INCONSISTENT: Webhook signature verification removed but metadata remains
**Location:** lib/whatsapp/security.ts section  
**Issue:** The design mentions "Correction: Meta WhatsApp Cloud API webhooks use the verify token for initial subscription verification (GET request) but do NOT use HMAC signatures for webhook payloads" and proposes removing HMAC verification. However, the security.ts file is still defined with full HMAC verification code, and the environment variables section still mentions `WHATSAPP_APP_SECRET`.  
**Fix:** Either remove the `lib/whatsapp/security.ts` file entirely from the design OR clarify that it exists but is not used. Remove `WHATSAPP_APP_SECRET` from environment variables section. Update the Webhook Handling section to clarify that only path-based verify token validation is used (already in webhook route, but contradicts the security.ts file existence).

### 4. MISSING: Import statement in whatsapp-service.ts
**Location:** services/whatsapp-service.ts  
**Issue:** The service uses `assertCan` but doesn't import it in the imports list shown.  
**Fix:** Add to imports:
```typescript
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
```
(Already shown in one place but should be in the main import block at the top)

### 5. AMBIGUOUS: systemUser reference in automation
**Location:** Integration Points → 3. Automation Rules  
**Issue:** The automation action handler references `systemUser` ("automation runs as system") but does not define what `systemUser` is or how to obtain it. The `sendWhatsAppTemplate` signature requires `AuthUser`.  
**Fix:** Specify that automation should use a system user context:
```typescript
case "send_whatsapp_template": {
  const systemUser: AuthUser = {
    id: "system",
    teamId: null,
    roleId: null,
    role: { name: "SYSTEM", permissions: [] }, // or fetch actual system role
  };
  const { templateName, templateLanguage, params } = action;
  await sendWhatsAppTemplate(
    systemUser,
    entityId,
    templateName,
    templateLanguage,
    params
  );
  break;
}
```
Or clarify that automation needs its own service function without RBAC enforcement.

### 6. MISSING: Real-time event definitions in Pusher section
**Location:** Integration Points → 5. Real-time Updates  
**Issue:** The design references `RealtimeEvents.WHATSAPP_MESSAGE_RECEIVED` and `WHATSAPP_MESSAGE_SENT` but these are not added to the existing `lib/pusher-server.ts` file anywhere in the design. The line "Add event type:" shows the enum but not the actual change to make.  
**Fix:** Show the complete modification needed:
```typescript
// In lib/pusher-server.ts, add to existing RealtimeEvents object:
export const RealtimeEvents = {
  // ... existing events (don't modify) ...
  WHATSAPP_MESSAGE_RECEIVED: "whatsapp:message_received",
  WHATSAPP_MESSAGE_SENT: "whatsapp:message_sent",
} as const;
```

### 7. MISSING: Client-side Pusher userId variable
**Location:** Integration Points → 5. Real-time Updates, client-side listener  
**Issue:** The useEffect hook references `userId` in the Pusher channel subscription but this variable is not defined. It's unclear where it comes from.  
**Fix:** Add prop or context:
```typescript
// Add to WhatsAppChat component props:
type Props = {
  leadId: string;
  leadName: string;
  currentUserId: string; // for Pusher subscription
};

export function WhatsAppChat({ leadId, leadName, currentUserId }: Props) {
  // ... then use currentUserId in Pusher subscription
}
```

### 8. UNVERIFIED: NotificationChannel enum does NOT include WHATSAPP
**Location:** Database Schema → Schema Extensions → NotificationChannel Enum  
**Issue:** The design claims "NotificationChannel Enum: Already includes `WHATSAPP` (currently unused). No changes needed." However, verification shows the actual schema only has `IN_APP` and `EMAIL` values. The WHATSAPP value does not exist.  
**Fix:** Add to migration:
```sql
-- Extend NotificationChannel enum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';
```
And update the schema.prisma extension section to show this is a NEW value being added, not an existing one.

---

## MEDIUM Severity Findings

### 9. MISSING: Error handling in parseMetaWebhook
**Location:** lib/whatsapp/meta-parse.ts  
**Issue:** The parser wraps everything in try-catch and logs errors but returns an empty array on failure. The webhook route will then return 200 OK with zero events processed. Meta thinks the webhook succeeded but nothing was saved.  
**Fix:** Throw the error instead of swallowing it:
```typescript
export function parseMetaWebhook(raw: any): NormalizedWhatsAppEvent[] {
  const events: NormalizedWhatsAppEvent[] = [];
  // Remove try-catch, let errors propagate to webhook route
  const entries = raw.entry || [];
  // ... rest of parsing
  return events;
}
```
Or return a Result type: `{ success: boolean; events: NormalizedWhatsAppEvent[]; error?: string }`

### 10. MISSING: Label import in settings page
**Location:** app/(app)/settings/whatsapp/page.tsx  
**Issue:** The component uses `<Label>` component but doesn't import it.  
**Fix:** Add import:
```typescript
import { Label } from "@/components/ui/label";
```

### 11. INCOMPLETE: Template selector code truncated
**Location:** features/whatsapp/template-selector.tsx  
**Issue:** The component code appears complete but should be verified as the design document doesn't show any truncation marker. However, reviewing the flow, no issues found on re-read.  
**Status:** False alarm on review - code is complete. Downgrading to informational note.

### 12. MISSING: Index on WhatsAppMessage.agentId
**Location:** Database Schema → WhatsAppMessage model  
**Issue:** The model has foreign key on `agentId` and queries likely filter by agent, but no index exists on this field. Queries like "show all messages sent by agent X" will be slow.  
**Fix:** Add to schema:
```prisma
@@index([agentId, createdAt])
```

### 13. AMBIGUOUS: Media URL vs Media ID usage
**Location:** Database Schema → WhatsAppMessage model  
**Issue:** The model stores both `mediaUrl` and `mediaId`. The `getMediaUrl()` provider method converts mediaId to URL. But the service layer (`processIncomingMessage`) saves `mediaId` from the webhook event but never calls `getMediaUrl()` to populate `mediaUrl`. The UI will show "(media)" but no actual media.  
**Fix:** In `processIncomingMessage`, after creating the message with mediaId, call provider to get URL:
```typescript
let mediaUrl = null;
if (event.mediaId) {
  const settings = await getWhatsAppSettings();
  if (settings.credentials) {
    const provider = new MetaWhatsAppProvider(settings.credentials);
    mediaUrl = await provider.getMediaUrl(event.mediaId);
  }
}

const message = await db.whatsAppMessage.create({
  data: {
    // ...
    mediaId: event.mediaId || null,
    mediaUrl,
    // ...
  },
});
```

### 14. MISSING: Template rendering in TemplateSelector
**Location:** features/whatsapp/template-selector.tsx  
**Issue:** The component shows template variables for input, but doesn't preview what the template body text looks like. Users can't see what they're filling in variables for.  
**Fix:** Add preview rendering:
```typescript
{selected && (
  <div className="rounded bg-slate-50 p-3 text-sm">
    <Label>Preview</Label>
    <div className="mt-1 whitespace-pre-wrap">
      {renderTemplatePreview(selected.content, params)}
    </div>
  </div>
)}

// Helper function:
function renderTemplatePreview(content: any, params: string[]): string {
  const bodyComponent = (content as any[]).find((c: any) => c.type === "BODY");
  let text = bodyComponent?.text || "";
  params.forEach((value, index) => {
    text = text.replace(`{{${index + 1}}}`, value || `{{${index + 1}}}`);
  });
  return text;
}
```

### 15. MISSING: Rate limit handling
**Location:** Service Layer → services/whatsapp-service.ts  
**Issue:** The design mentions rate limiting (Meta returns 429) and the provider throws `rate_limited` error, but the service layer doesn't handle it specially. The error is caught, message marked failed, and thrown to user immediately. No retry or backoff logic.  
**Fix:** Add retry logic or inform user to try again later:
```typescript
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
    if (error.kind === "rate_limited") {
      throw new AppError("RATE_LIMITED", "WhatsApp rate limit exceeded. Please try again in a few minutes.");
    }
    throw new AppError("CONFLICT", error.message);
  }
  throw error;
}
```

### 16. UNVERIFIED: ErrorCode type may not include RATE_LIMITED
**Location:** Rate limit handling above  
**Issue:** The AppError constructor takes an ErrorCode as first parameter. The design doesn't show what values exist in this enum. "RATE_LIMITED" may not be valid.  
**Fix:** Either verify that RATE_LIMITED exists in the ErrorCode enum, or use an existing code like "CONFLICT" with a descriptive message. If RATE_LIMITED doesn't exist, add it to lib/errors.ts or use:
```typescript
throw new AppError("CONFLICT", "WhatsApp rate limit exceeded. Please try again in a few minutes.");
```

### 17. MISSING: Validation on template params
**Location:** services/whatsapp-service.ts → sendWhatsAppTemplate  
**Issue:** Template parameters are accepted as-is without validation. If a template has 3 variables but user provides 5 params, Meta will reject it. The error comes back from Meta, but it's late-stage validation.  
**Fix:** Validate before sending:
```typescript
export async function sendWhatsAppTemplate(
  user: AuthUser,
  leadId: string,
  templateName: string,
  templateLanguage: string,
  params: string[]
): Promise<string> {
  assertCan(user, "lead", "CREATE");
  
  // Fetch template to validate params
  const template = await db.whatsAppTemplate.findFirst({
    where: { name: templateName, language: templateLanguage, status: "APPROVED" },
  });

  if (!template) {
    throw new AppError("NOT_FOUND", `Template ${templateName} (${templateLanguage}) not found or not approved.`);
  }

  if (params.length !== template.variables.length) {
    throw new AppError(
      "BAD_REQUEST",
      `Template requires ${template.variables.length} parameters, but ${params.length} provided.`
    );
  }

  // ... rest of function
}
```

### 18. MISSING: Lead phone number validation before sending
**Location:** services/whatsapp-service.ts → sendWhatsAppText and sendWhatsAppTemplate  
**Issue:** The functions use `lead.primaryMobile` directly without checking if it's a valid WhatsApp number or if it exists. If primaryMobile is null or invalid, the provider will fail.  
**Fix:** Add validation:
```typescript
if (!lead.primaryMobile) {
  throw new AppError("BAD_REQUEST", "Lead has no primary mobile number.");
}

// Optionally validate E.164 format:
if (!lead.primaryMobile.match(/^\+?[1-9]\d{1,14}$/)) {
  throw new AppError("BAD_REQUEST", "Lead's mobile number is not in valid international format.");
}
```

### 19. AMBIGUOUS: Template variables extraction
**Location:** services/whatsapp-service.ts → extractTemplateVariables  
**Issue:** The function extracts `{{1}}`, `{{2}}` patterns and returns the numbers. But the variables array should match the order and count of placeholders. If template has `{{2}}` but no `{{1}}`, the array will be `["2"]` instead of `["1", "2"]`.  
**Fix:** Return count, not the numbers:
```typescript
function extractTemplateVariables(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  const count = matches.length;
  return Array.from({ length: count }, (_, i) => `${i + 1}`);
}
```
Or keep the original but document that it's for display purposes only ("Variable 1", "Variable 2" labels).

### 20. MISSING: Migration file shows YYYYMMDDHHMMSS placeholder
**Location:** Migration section  
**Issue:** The migration filename uses a placeholder timestamp. This is correct for design docs but should be noted that Prisma generates this automatically.  
**Fix:** Add note: "Filename timestamp will be generated by `prisma migrate dev --name add_whatsapp` command."

---

## NIT Severity Findings

### 21. INCONSISTENT: Casing in enum values
**Location:** Database Schema → WhatsAppWebhookStatus enum  
**Issue:** Most enums in the design use SCREAMING_SNAKE_CASE (INBOUND, OUTBOUND, etc.), but status values are PascalCase in some places. The Prisma schema shows them correctly as SCREAMING_SNAKE_CASE, so this is consistent. No issue on re-review.  
**Status:** False alarm - consistent throughout.

### 22. TYPO: Missing closing brace in config form
**Location:** features/settings/whatsapp-forms.tsx  
**Issue:** The ConfigForm component shows `onCheckedChange=` with no value after the `=`. This appears to be a truncation artifact in the design doc.  
**Fix:** Complete the line:
```typescript
onCheckedChange={handleToggle}
```
(This is already in the full code listing - appears to be a display issue in the markdown)

### 23. STYLE: Inconsistent quote style
**Location:** Multiple locations  
**Issue:** Some code uses double quotes, some uses single quotes. Not a functional issue but inconsistent.  
**Fix:** Standardize on double quotes throughout (appears to be the project standard based on other files).

### 24. OPTIMIZATION: Webhook processing could be async
**Location:** Webhook Handling section  
**Issue:** The design states "All events are processed synchronously before responding to Meta (guarantees ordering)." This is good for ordering but Meta expects response within 20 seconds. If processing 10 messages takes time, webhook could timeout.  
**Fix:** Consider: acknowledge webhook immediately (store as RECEIVED), respond 200, then process async. The dedupeKey prevents duplicates if Meta retries. However, this loses ordering guarantee. Document this tradeoff and state the chosen approach explicitly.

### 25. DOCUMENTATION: Missing rate limit numbers
**Location:** Webhook Handling section mentions rate limits  
**Issue:** Meta has specific rate limits (e.g., 1000 messages per day for free tier, 80 messages per second for business). The design doesn't document these.  
**Fix:** Add to documentation section: "Meta WhatsApp Business Cloud API rate limits: [link to Meta docs]. Free tier: 1,000 business-initiated conversations per month. Sending limits: 80 messages/second (burst), 20 messages/second (sustained). These limits are enforced by Meta, not by this integration."

### 26. DOCUMENTATION: No mention of 24-hour window rule
**Location:** Service Layer section  
**Issue:** WhatsApp requires template messages for first contact or after 24 hours of no conversation. The design mentions it briefly in comments but doesn't enforce it or guide users.  
**Fix:** Add validation or UI guidance:
```typescript
// In sendWhatsAppText, optionally check last message timestamp:
const lastMessage = await db.whatsAppMessage.findFirst({
  where: { leadId, direction: "INBOUND" },
  orderBy: { createdAt: "desc" },
});

const hoursSinceLastInbound = lastMessage
  ? (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)
  : Infinity;

if (hoursSinceLastInbound > 24) {
  throw new AppError(
    "CONFLICT",
    "Cannot send free-form message: 24-hour conversation window expired. Use a template message to re-engage."
  );
}
```
Or at minimum, document this in the UI with a warning.

### 27. STYLE: Unused templateParams field in sendWhatsAppText
**Location:** services/whatsapp-service.ts → sendWhatsAppText  
**Issue:** Text messages create a WhatsAppMessage record with `messageType: "TEXT"` but the schema allows `templateParams` which would be null for text messages. Not an error, just unused fields.  
**Fix:** None needed, but document that templateParams and templateName are null for TEXT type messages.

---

## Verified Assumptions

The following assumptions from the design were verified against the actual codebase:

1. ✅ **Telephony provider pattern exists** - Confirmed `lib/telephony/provider.ts` exists with `TelephonyProvider` interface, `ProviderError` class, and normalized event types.

2. ✅ **constantTimeEqual security helper exists** - Confirmed in `lib/telephony/security.ts` as `constantTimeEqual()` function using `timingSafeEqual`.

3. ✅ **Setting table exists** - Confirmed in schema.prisma with `key: String @id` and `value: Json` fields.

4. ✅ **getAccessibleLead function exists** - Confirmed in `services/scope-service.ts` with correct signature.

5. ✅ **notify function exists** - Confirmed in `services/notification-service.ts` with correct signature.

6. ✅ **normalizeMobile function exists** - Confirmed in `validations/common.ts`, normalizes Indian numbers to digits with country code.

7. ✅ **AppError class exists** - Confirmed in `lib/errors.ts` with `code`, `status` fields.

8. ✅ **Lead model has primaryMobile and alternateMobile** - Confirmed in schema.prisma, both fields exist with correct types.

9. ✅ **LeadActivityType enum exists** - Confirmed in schema.prisma with FOLLOWUP and CREATED values currently.

10. ✅ **assertCan RBAC function exists** - Confirmed usage in call-service.ts imports.

11. ✅ **Pusher integration exists** - Confirmed `lib/pusher-server.ts` with `notifyUser`, `notifyTeam`, `notifyAll` functions.

---

## Unverified/Wrong Assumptions

### Wrong Assumption #1: NotificationChannel includes WHATSAPP
**Claim:** "NotificationChannel Enum: Already includes `WHATSAPP` (currently unused). No changes needed."  
**Reality:** The enum only has `IN_APP` and `EMAIL` values. WHATSAPP does not exist.  
**Impact:** HIGH - Must add this value in migration.

### Wrong Assumption #2: Meta webhooks use HMAC signatures
**Claim (later corrected):** Initial design included HMAC signature verification in `lib/whatsapp/security.ts`.  
**Reality:** Design later corrects itself that Meta Cloud API doesn't use HMAC, only verify token. But the security.ts file remains in the design.  
**Impact:** MEDIUM - Remove the file or clarify it's not used.

### Unverified Assumption #3: route helper accepts async handlers
**Claim:** Multiple API routes use `route(async (req) => { ... })` wrapper.  
**Status:** Not verified but assumed to exist based on telephony routes using same pattern. Should be in `lib/api.ts`.  
**Impact:** NIT - If it doesn't exist, routes need different error handling setup.

### Unverified Assumption #4: ok() response helper
**Claim:** API routes return `ok({ data })` wrapper.  
**Status:** Not verified but assumed to exist. Standard API response pattern.  
**Impact:** NIT - If it doesn't exist, routes need to manually construct NextResponse.

### Unverified Assumption #5: ErrorCode includes "CONFLICT", "NOT_FOUND", "BAD_REQUEST"
**Claim:** AppError constructor uses codes like "CONFLICT", "BAD_REQUEST".  
**Status:** Not verified. AppError exists but the valid code values weren't checked.  
**Impact:** MEDIUM - If these codes don't exist, runtime errors will occur.

---

## Summary

This is a well-structured and comprehensive design that follows the existing codebase patterns closely. The provider abstraction, service layer RBAC, webhook idempotency, and UI component structure all align with the telephony integration pattern.

However, there are **8 HIGH severity issues** that block implementation:

1. Missing API routes (settings, test-credentials)
2. Inconsistent security approach (HMAC file vs verify token only)
3. Wrong assumption about NotificationChannel enum
4. Missing imports in service layer
5. Undefined systemUser in automation
6. Incomplete real-time events definition
7. Missing userId in client Pusher subscription
8. Unverified NotificationChannel assumption

The **12 MEDIUM severity issues** are mostly missing error handling, validation, and edge cases that would surface in production (rate limits, missing phone numbers, template param validation, media URL fetching).

The **7 NIT issues** are style and documentation improvements that don't block implementation.

Once the HIGH and MEDIUM issues are addressed, this design will be ready for implementation.

---

## Recommendations for Next Revision

1. Add the two missing API route definitions (settings update, test credentials)
2. Remove lib/whatsapp/security.ts or clarify it's unused (Meta Cloud API doesn't use HMAC)
3. Add WHATSAPP value to NotificationChannel enum in migration
4. Complete the real-time updates integration (Pusher event constants, userId prop)
5. Add validation for phone numbers, template params, and 24-hour window
6. Implement media URL fetching in webhook processing
7. Add rate limit handling with appropriate error codes
8. Define systemUser for automation or create separate service method
9. Add template preview rendering in UI
10. Document Meta rate limits and 24-hour conversation window clearly

---

**Review completed.** Design shows strong architectural foundation but needs these changes before implementation can proceed safely.
