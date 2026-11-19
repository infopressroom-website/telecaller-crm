# WhatsApp Integration - Codebase Exploration Report

## Project Overview

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM, PostgreSQL, Tailwind CSS  
**Architecture:** Monolithic Next.js app with service layer pattern  
**Testing:** Vitest for unit tests, integration tests available  
**Build Commands:**
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run typecheck` - Type checking
- `npm test` - Unit tests
- `npm run verify` - Full verification (typecheck + lint + tests + build)

## Architecture Patterns Discovered

### 1. Services Layer (`/services`)

**Pattern:** Server-only service modules with clear separation of concerns

**Key Files Reviewed:**
- `services/notification-service.ts` - Notification handling (IN_APP only currently)
- `services/lead-service.ts` - Lead management operations
- `services/call-service.ts` - Call logging and telephony
- `services/auth-service.ts` - Authentication
- `services/automation-service.ts` - Automation rules

**Service Pattern:**
```typescript
import "server-only";  // Must be first line
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";

export async function serviceName(user: AuthUser, params) {
  assertCan(user, "resource", "ACTION");  // RBAC check
  // Business logic
  return result;
}
```

**Existing Notification Pattern:**
- Function: `notify({ userId, title, body?, link?, dedupeKey? })`
- Channel: Currently only `IN_APP` implemented
- Status: PENDING → SENT → DELIVERED/FAILED/READ
- Database: `Notification` table with `channel` enum including `WHATSAPP` (not implemented)
- Real-time: Integrates with Pusher for live notifications
- Deduplication: Uses `dedupeKey` (unique constraint) to prevent duplicates

### 2. API Routes (`/app/api`)

**Pattern:** Next.js 14 App Router with centralized error handling

**Structure:**
```
app/api/
  ├── notifications/route.ts
  ├── auth/me/route.ts
  ├── leads/[id]/route.ts
  ├── webhooks/telephony/[provider]/[secret]/route.ts
  └── cron/automation/route.ts
```

**Route Pattern:**
```typescript
import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { serviceName } from "@/services/service-name";

export const dynamic = "force-dynamic";  // For dynamic routes

export const POST = route(async (req) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  
  const body = await req.json();
  // Validation with Zod
  const result = await serviceName(user, body);
  
  return ok(result);
});
```

**Error Handling:** Centralized via `route()` wrapper in `lib/api.ts`
- ZodError → 400 VALIDATION_ERROR
- AppError → Custom status code
- Unknown → 500 INTERNAL_ERROR

### 3. Database Access (`lib/db.ts` & Prisma)

**Pattern:** Single Prisma client instance with connection pooling

```typescript
export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
```

**Schema Highlights (relevant to WhatsApp):**
- `NotificationChannel` enum: `IN_APP | EMAIL | SMS | WHATSAPP`
- `NotificationStatus` enum: `PENDING | SENT | DELIVERED | FAILED | READ`
- `Notification` table: Has channel field, ready for WhatsApp
- `Lead` table: Has `primaryMobile`, `alternateMobile` (E.164 format)
- `LeadActivity` table: Timeline entries (append-only)

**Transaction Pattern:**
```typescript
await db.$transaction(async (tx) => {
  await tx.model.update(...);
  await tx.leadActivity.create(...);
});
```

### 4. Auth & RBAC (`lib/auth/`)

**Pattern:** Permission-based access control checked in service layer

**Key Files:**
- `lib/auth/rbac.ts` - Permission checking
- `lib/auth/session.ts` - Session management
- `lib/auth/scope.ts` - Data scoping by role

**Usage:**
```typescript
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleKey: RoleKey;
  permissions: ReadonlySet<string>;
};

assertCan(user, "lead", "VIEW");  // Throws if unauthorized
can(user, "resource", "ACTION");   // Returns boolean
```

**Permissions:** Stored as `resource:ACTION` strings (e.g., "lead:VIEW", "settings:MANAGE")

### 5. External Provider Integration Pattern (`lib/telephony/`)

**Pattern:** Provider interface → Implementation → Registry

**Structure:**
```
lib/telephony/
  ├── provider.ts         # Interface definition
  ├── exotel.ts          # Exotel implementation
  ├── sandbox.ts         # Test implementation
  ├── registry.ts        # Provider registration
  ├── config.ts          # Configuration
  └── security.ts        # Webhook validation
```

**Provider Interface:**
```typescript
export interface TelephonyProvider {
  readonly key: string;
  readonly label: string;
  readonly isSandbox: boolean;
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  testCredentials(): Promise<{ ok: boolean; message: string }>;
  getCallDetails(callId: string): Promise<NormalizedCallEvent | null>;
}
```

**Key Insights:**
- Webhook deduplication via `dedupeKey` (unique constraint)
- Event normalization to internal format
- Idempotency for operations (e.g., `clientRef` for calls)
- Settings stored in database `Setting` table (JSON values)
- Graceful degradation when provider not configured

### 6. Timeline/Activity Pattern

**Pattern:** Append-only `LeadActivity` table for audit trail

**Activity Types:**
```typescript
enum LeadActivityType {
  FOLLOWUP | CREATED | UPDATED | STATUS_CHANGED | NOTE | MERGED | IMPORTED
}
```

**Usage Pattern:**
```typescript
await tx.leadActivity.create({
  data: {
    leadId: id,
    type: "NOTE",
    actorId: user.id,
    message: "User-visible message",
    data: { /* structured data */ }
  }
});
```

**Display:** Timeline aggregates activities, calls, assignments, follow-ups

### 7. Environment Configuration (`lib/env.ts`)

**Pattern:** Zod-validated environment variables with feature flags

```typescript
export const env = parseEnv();  // Throws on missing required vars
export const features = {
  redis: Boolean(env.REDIS_URL),
  telephony: Boolean(env.TELEPHONY_PROVIDER),
  ai: Boolean(env.ANTHROPIC_API_KEY),
  pusher: Boolean(env.PUSHER_APP_ID && ...),
};
```

**Environment Variables:**
- Required: `DATABASE_URL`, `AUTH_SECRET` (production)
- Optional: Provider-specific configs (TELEPHONY_, PUSHER_, etc.)
- Pattern: Empty string = feature disabled, graceful degradation

### 8. Real-time Notifications (Pusher Integration)

**Pattern:** Optional real-time via Pusher, gracefully degrades

**File:** `lib/pusher-server.ts`

**Usage:**
```typescript
await notifyUser(userId, RealtimeEvents.NOTIFICATION_CREATED, {
  id: notification.id,
  title: notification.title,
  ...
});
```

**Events:** Pre-defined event constants in `RealtimeEvents`

### 9. UI Component Structure

**Directories:**
- `components/ui/` - Reusable UI primitives (button, card, badge, etc.)
- `components/leads/` - Domain-specific components
- `components/layout/` - Layout components
- `app/(app)/` - App pages (authenticated)
- `app/(admin)/` - Admin pages
- `features/` - Feature-specific code

**Pattern:** Server Components by default, Client Components marked with `"use client"`

### 10. Validation (`/validations`)

**Pattern:** Zod schemas with transformation and defaults

**Files:**
- `validations/lead.ts` - Lead input validation
- `validations/common.ts` - Shared validators (mobileSchema)

**Mobile Validation:**
```typescript
export const mobileSchema = z.string()
  .trim()
  .regex(/^[+]?[0-9]{10,15}$/)
  .transform(normalizeMobile);  // Converts to E.164
```

## WhatsApp Integration Fit

### Where WhatsApp Will Integrate

Based on exploration, WhatsApp integration should follow these patterns:

#### 1. **Service Layer** (`services/whatsapp-service.ts`)
- Follow notification-service pattern
- Server-only module
- Functions: `sendWhatsAppMessage()`, `handleIncomingMessage()`, `getMessageHistory()`
- RBAC checks for sending messages
- Deduplication via unique keys

#### 2. **Provider Abstraction** (`lib/whatsapp/`)
Similar to telephony pattern:
- `lib/whatsapp/provider.ts` - Interface definition
- `lib/whatsapp/meta.ts` - Meta Cloud API implementation
- `lib/whatsapp/twilio.ts` - Optional Twilio implementation
- `lib/whatsapp/registry.ts` - Provider selection
- `lib/whatsapp/config.ts` - Configuration helpers

#### 3. **Database Models** (Prisma Schema)
New models needed:
- `WhatsAppMessage` - Message log (like `CallLog`)
- `WhatsAppTemplate` - Message templates
- `WhatsAppWebhookEvent` - Raw webhook storage (like `CallEvent`)

Existing models to use:
- `Notification` - Already has WHATSAPP channel
- `Lead` - Already has mobile numbers
- `LeadActivity` - Add WHATSAPP_MESSAGE type

#### 4. **API Routes**
```
app/api/whatsapp/
  ├── send/route.ts           # Send message
  ├── templates/route.ts      # List templates
  ├── history/[leadId]/route.ts  # Message history
  └── webhook/[secret]/route.ts  # Incoming webhooks
```

#### 5. **UI Components**
```
features/whatsapp/
  ├── whatsapp-chat.tsx       # Chat interface
  ├── message-composer.tsx    # Send message form
  ├── template-selector.tsx   # Template picker
  └── message-timeline.tsx    # Message history
```

Add to lead detail page: WhatsApp tab alongside Timeline, Calls, etc.

#### 6. **Settings Integration**
- Add WhatsApp provider settings to `Setting` table
- Settings page: `/app/(app)/settings/whatsapp/page.tsx`
- Follow telephony settings pattern

#### 7. **Automation Integration**
- Extend `AutomationRule` actions to include "Send WhatsApp"
- Template selection in automation UI
- Status updates trigger WhatsApp notifications

## Key Patterns to Follow

### ✅ DO:
1. **Add "server-only" import** as first line in service files
2. **Use `assertCan()` or `can()`** for permission checks
3. **Wrap API routes** with `route()` for error handling
4. **Return `ok(data)`** for successful API responses
5. **Use Zod schemas** for input validation
6. **Create LeadActivity entries** for timeline integration
7. **Use transactions** when updating multiple tables
8. **Implement webhook deduplication** with unique keys
9. **Gracefully degrade** when provider not configured
10. **Store provider responses** in raw format first
11. **Normalize to internal format** for processing
12. **Use E.164 format** for phone numbers
13. **Add indexes** for query performance
14. **Write unit tests** in `tests/` directory
15. **Document in `docs/`** following existing patterns

### ❌ DON'T:
1. Don't expose internal errors to API responses
2. Don't skip RBAC checks in services
3. Don't use direct process.env access (use `env` from `lib/env.ts`)
4. Don't modify append-only tables (CallLog, LeadActivity, etc.)
5. Don't store sensitive data in plain text
6. Don't skip input validation
7. Don't create tight coupling between providers and business logic

## Existing Notification System

**Current State:**
- Database has `WHATSAPP` enum value in `NotificationChannel`
- Only `IN_APP` channel is implemented
- `notification-service.ts` has TODO comment: "email, SMS and WhatsApp are NOT wired up"
- Documentation (`docs/AUTOMATION.md`) explicitly states: "Email, SMS and WhatsApp are not implemented"

**Integration Point:**
The notification service already has the structure. WhatsApp implementation will:
1. Extend `notify()` function to handle WHATSAPP channel
2. Route to `whatsapp-service.ts` for actual sending
3. Update status based on webhook responses
4. Maintain existing deduplication logic

## Mobile Number Handling

**Current Pattern:**
- Stored in E.164 format: `+919876543210`
- Normalized via `normalizeMobile()` in `validations/common.ts`
- Validation: 10-15 digits, optional + prefix
- Function: `toE164()` in `lib/telephony/config.ts`

**WhatsApp Requirements:**
- Meta API requires E.164 format
- No changes needed to existing mobile storage
- Reuse existing normalization functions

## Real-time Updates

**Existing Pattern (Pusher):**
- Optional, gracefully degrades if not configured
- Events defined in `RealtimeEvents` constant
- Functions: `notifyUser()`, `notifyTeam()`, `notifyAll()`

**WhatsApp Integration:**
- Add new events: `WHATSAPP_MESSAGE_SENT`, `WHATSAPP_MESSAGE_RECEIVED`
- Trigger from webhook handler
- Update UI in real-time when messages arrive

## Testing Strategy

**Existing Test Structure:**
- Unit tests: `tests/*.test.ts`
- Integration tests: `tests/integration/*.int.test.ts`
- Setup: `tests/setup.ts`
- Helpers: `tests/helpers.ts`

**WhatsApp Tests Needed:**
1. Unit tests for WhatsApp service functions
2. Unit tests for webhook parsing/normalization
3. Unit tests for message validation
4. Integration tests for send → webhook → update flow
5. Integration tests for deduplication
6. Mock provider for testing

## File Naming Conventions

**Observed Patterns:**
- Services: `kebab-case-service.ts`
- Components: `kebab-case.tsx`
- API routes: `route.ts` in feature directory
- Tests: `feature.test.ts` or `feature.int.test.ts`
- Types: Inline or in `types/` directory
- Validations: `feature.ts` in `validations/`

## Documentation Requirements

**Existing Docs:**
- `docs/PHASES.md` - Feature phases
- `docs/ARCHITECTURE.md` - System architecture
- `docs/API.md` - API documentation
- `docs/AUTOMATION.md` - Automation features
- Feature-specific docs in `docs/`

**WhatsApp Needs:**
- `docs/WHATSAPP.md` - Setup guide, API reference, troubleshooting
- Update `docs/ARCHITECTURE.md` with WhatsApp integration
- Update `docs/API.md` with new endpoints
- Update `docs/AUTOMATION.md` with WhatsApp actions
- Update `.env.example` with WhatsApp variables

## Key Files for Implementation

### Must Read (Already Reviewed):
1. ✅ `services/notification-service.ts` - Notification pattern
2. ✅ `services/lead-service.ts` - Service layer pattern
3. ✅ `lib/telephony/provider.ts` - Provider interface pattern
4. ✅ `lib/telephony/exotel.ts` - Provider implementation example
5. ✅ `lib/api.ts` - API route wrapper
6. ✅ `lib/auth/rbac.ts` - Permission checking
7. ✅ `lib/env.ts` - Environment configuration
8. ✅ `prisma/schema.prisma` - Database schema
9. ✅ `app/api/notifications/route.ts` - API route pattern

### Should Review (Not Yet Read):
10. `lib/telephony/security.ts` - Webhook signature validation pattern
11. `app/(app)/settings/telephony/page.tsx` - Settings UI pattern
12. `features/workspace/call-panel.tsx` - Feature component pattern
13. `services/automation-service.ts` - Automation integration
14. `lib/redis.ts` - Caching pattern (if implemented)

## Environment Variables Needed

```env
# WhatsApp Business API (Meta Cloud API)
WHATSAPP_PROVIDER="meta"  # or "twilio"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_BUSINESS_ACCOUNT_ID="your_business_account_id"
WHATSAPP_ACCESS_TOKEN="your_access_token"
WHATSAPP_WEBHOOK_SECRET="your_random_webhook_secret_min_24_chars"
WHATSAPP_VERIFY_TOKEN="your_webhook_verify_token"

# Optional: Twilio
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_NUMBER=""
```

## Summary: Implementation Strategy

WhatsApp integration will follow the **exact same pattern as telephony**:

1. **Provider abstraction layer** (`lib/whatsapp/`) with interface → implementations
2. **Service layer** (`services/whatsapp-service.ts`) with RBAC and business logic
3. **API routes** for send, webhook, history with centralized error handling
4. **Database models** for messages, templates, webhook events
5. **Settings integration** for provider configuration
6. **UI components** for chat interface in lead detail page
7. **Automation integration** for auto-send capabilities
8. **Timeline integration** via LeadActivity entries
9. **Real-time updates** via Pusher (optional)
10. **Comprehensive testing** with mocks and integration tests

**Estimated Complexity:** Medium (2-3 days)
- High code reuse from telephony pattern
- Well-defined integration points
- Clear architectural patterns
- Existing infrastructure (notifications, webhooks, activities)

**Risks:**
- Meta API webhook signature validation (need to verify format)
- Rate limiting (Meta has limits, need to handle)
- Template approval process (Meta requires pre-approved templates)
- Message status tracking (delivery, read receipts)

**Next Steps:**
1. Create detailed implementation plan
2. Design database schema changes
3. Implement provider interface
4. Build service layer
5. Create API routes
6. Add UI components
7. Write tests
8. Document setup process
