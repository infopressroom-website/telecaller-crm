# Database reference

Generated from `prisma/schema.prisma` (re-generate after schema changes). PostgreSQL. Ids are cuid/UUID strings; money is stored in paise.

**42 tables, 23 enums.**

## Tables

### Role
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `key` | String | unique | e.g. SUPER_ADMIN, TELECALLER |
| `name` | String |  |  |
| `description` | String? |  |  |
| `isSystem` | Boolean | default |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

### Permission
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `resource` | String |  | e.g. lead, call, report |
| `action` | PermissionAction |  |  |

Indexes/constraints: `@@unique([resource, action])`

### RolePermission
| Column | Type | Flags | Notes |
|---|---|---|---|
| `roleId` | String |  |  |
| `permissionId` | String |  |  |

Indexes/constraints: `@@id([roleId, permissionId])`

### User
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `employeeId` | String? | unique |  |
| `name` | String |  |  |
| `email` | String | unique |  |
| `phone` | String? |  |  |
| `passwordHash` | String |  |  |
| `status` | UserStatus | default |  |
| `roleId` | String |  |  |
| `teamId` | String? |  |  |
| `reportingToId` | String? |  |  |
| `joinedAt` | DateTime? |  |  |
| `lastLoginAt` | DateTime? |  |  |
| `failedLogins` | Int | default |  |
| `lockedUntil` | DateTime? |  |  |
| `maxActiveLeads` | Int? |  |  |
| `dailyLeadLimit` | Int? |  |  |
| `mustChangePassword` | Boolean | default | set for temporary passwords; the user must choose their own before using the app |
| `assignmentPaused` | Boolean | default | manager switch: no NEW automatic assignments |
| `serviceCities` | String[] | default | for location-based distribution |
| `serviceStates` | String[] | default |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |
| `archivedAt` | DateTime? |  |  |

Indexes/constraints: `@@index([roleId])`; `@@index([teamId])`; `@@index([status])`

### Session
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `tokenHash` | String | unique |  |
| `userId` | String |  |  |
| `expiresAt` | DateTime |  | absolute expiry |
| `lastSeenAt` | DateTime | default | idle-timeout tracking |
| `ipAddress` | String? |  |  |
| `userAgent` | String? |  |  |
| `revokedAt` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([userId])`; `@@index([expiresAt])`

### PasswordResetToken
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `tokenHash` | String | unique |  |
| `userId` | String |  |  |
| `expiresAt` | DateTime |  |  |
| `usedAt` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([userId])`

### LoginHistory
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `userId` | String? |  |  |
| `email` | String |  |  |
| `success` | Boolean |  |  |
| `ipAddress` | String? |  |  |
| `userAgent` | String? |  |  |
| `reason` | String? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([userId, createdAt])`; `@@index([email, createdAt])`

### Team
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String | unique |  |
| `leaderId` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |
| `archivedAt` | DateTime? |  |  |

### LeadSource
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String | unique |  |
| `isActive` | Boolean | default |  |
| `createdAt` | DateTime | default |  |
| `archivedAt` | DateTime? |  |  |

### Campaign
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String | unique |  |
| `isActive` | Boolean | default |  |
| `startsAt` | DateTime? |  |  |
| `endsAt` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |
| `archivedAt` | DateTime? |  |  |

### Lead
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `leadCode` | String | unique | human-friendly, e.g. LD-000123 (generated in service layer) |
| `name` | String |  |  |
| `primaryMobile` | String |  | stored normalised (digits, with country code) |
| `alternateMobile` | String? |  |  |
| `email` | String? |  |  |
| `city` | String? |  |  |
| `state` | String? |  |  |
| `status` | LeadStatus | default |  |
| `priority` | LeadPriority | default |  |
| `sourceId` | String? |  |  |
| `campaignId` | String? |  |  |
| `ownerId` | String? |  |  |
| `teamId` | String? |  |  |
| `nextFollowUpAt` | DateTime? |  |  |
| `lastContactedAt` | DateTime? |  |  |
| `notes` | String? |  |  |
| `customFields` | Json? |  | configurable optional fields |
| `mergedIntoId` | String? |  | set when this lead was merged into another (then archivedAt is set too) |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |
| `archivedAt` | DateTime? |  |  |

Indexes/constraints: `@@index([primaryMobile])`; `@@index([ownerId, status])`; `@@index([teamId, status])`; `@@index([campaignId, status])`; `@@index([sourceId])`; `@@index([status, createdAt])`; `@@index([nextFollowUpAt])`

### LeadAssignment
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `leadId` | String |  |  |
| `fromUserId` | String? |  |  |
| `toUserId` | String? |  |  |
| `actorId` | String? |  |  |
| `method` | AssignmentMethod |  |  |
| `approval` | AssignmentApproval | default |  |
| `reason` | String? |  |  |
| `idempotencyKey` | String? | unique | guards against duplicate assignment jobs |
| `ruleId` | String? |  | distribution rule that produced this assignment |
| `runId` | String? |  | distribution run it belongs to |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([leadId, createdAt])`; `@@index([toUserId, createdAt])`; `@@index([createdAt])`

### CallDisposition
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `key` | String | unique | e.g. CONNECTED, NOT_ANSWERED |
| `label` | String |  |  |
| `isConnected` | Boolean | default |  |
| `isFinal` | Boolean | default |  |
| `isActive` | Boolean | default |  |
| `sortOrder` | Int | default |  |
| `isSystem` | Boolean | default | built-in outcomes can be relabelled but not deleted |
| `requiresFollowUp` | Boolean | default | the agent must schedule a follow-up |
| `setsLeadStatus` | LeadStatus? |  | optional: move the lead to this status (custom outcomes) |

### CallLog
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `leadId` | String |  |  |
| `agentId` | String |  |  |
| `direction` | CallDirection | default |  |
| `status` | CallStatus | default |  |
| `dispositionId` | String? |  |  |
| `providerName` | String? |  |  |
| `providerCallId` | String? |  | unique per provider, used for duplicate-webhook protection |
| `clientRef` | String? | unique | browser-generated reference: makes 'start call' safe to retry (never dials twice) |
| `externalStatus` | String? |  | the provider's own status text, kept as received |
| `startedAt` | DateTime? |  |  |
| `endedAt` | DateTime? |  |  |
| `durationSec` | Int? |  |  |
| `notes` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

Indexes/constraints: `@@unique([providerName, providerCallId])`; `@@index([createdAt])`; `@@index([dispositionId, createdAt])`; `@@index([agentId, startedAt])`; `@@index([leadId, startedAt])`; `@@index([status])`

### Recording
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `callId` | String | unique |  |
| `storageKey` | String? |  |  |
| `providerUrl` | String? |  |  |
| `durationSec` | Int? |  |  |
| `sizeBytes` | Int? |  |  |
| `createdAt` | DateTime | default |  |

### FollowUp
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `leadId` | String |  |  |
| `ownerId` | String |  |  |
| `dueAt` | DateTime |  |  |
| `priority` | LeadPriority | default |  |
| `status` | FollowUpStatus | default |  |
| `notes` | String? |  |  |
| `completedAt` | DateTime? |  |  |
| `rescheduledFromId` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

Indexes/constraints: `@@index([ownerId, status, dueAt])`; `@@index([leadId])`; `@@index([status, dueAt])`

### Task
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `title` | String |  |  |
| `description` | String? |  |  |
| `status` | TaskStatus | default |  |
| `priority` | LeadPriority | default |  |
| `dueAt` | DateTime? |  |  |
| `ownerId` | String |  |  |
| `creatorId` | String? |  |  |
| `leadId` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

Indexes/constraints: `@@index([ownerId, status])`

### Shift
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String | unique |  |
| `startTime` | String |  | "HH:mm" |
| `endTime` | String |  | "HH:mm" |
| `graceMinutes` | Int | default |  |

### UserShift
| Column | Type | Flags | Notes |
|---|---|---|---|
| `userId` | String |  |  |
| `shiftId` | String |  |  |
| `validFrom` | DateTime | default |  |

Indexes/constraints: `@@id([userId, shiftId, validFrom])`

### Attendance
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `userId` | String |  |  |
| `date` | DateTime |  |  |
| `status` | AttendanceStatus | default |  |
| `clockInAt` | DateTime? |  |  |
| `clockOutAt` | DateTime? |  |  |
| `breakMinutes` | Int | default |  |
| `isLate` | Boolean | default |  |
| `notes` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

Indexes/constraints: `@@unique([userId, date])`; `@@index([date])`

### Target
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `userId` | String? |  |  |
| `teamId` | String? |  |  |
| `metric` | TargetMetric |  |  |
| `period` | TargetPeriod |  |  |
| `value` | Int |  |  |
| `startsOn` | DateTime |  |  |
| `endsOn` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([userId, period])`; `@@index([teamId, period])`

### IncentiveSlab
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String |  |  |
| `metric` | TargetMetric |  |  |
| `minValue` | Int |  |  |
| `maxValue` | Int? |  |  |
| `amountPaise` | Int |  | money stored in paise to avoid float errors |
| `isActive` | Boolean | default |  |
| `createdAt` | DateTime | default |  |

### Incentive
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `userId` | String |  |  |
| `periodStart` | DateTime |  |  |
| `periodEnd` | DateTime |  |  |
| `amountPaise` | Int |  |  |
| `status` | IncentiveStatus | default |  |
| `calculation` | Json? |  | traceable breakdown of how the amount was derived |
| `approvedById` | String? |  |  |
| `approvedAt` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([userId, periodStart])`

### QaReview
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `callId` | String |  |  |
| `agentId` | String |  |  |
| `reviewerId` | String |  |  |
| `score` | Int? |  | 0–100 |
| `scorecard` | Json? |  |  |
| `feedback` | String? |  |  |
| `coachingNotes` | String? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([agentId, createdAt])`; `@@index([callId])`

### AutomationRule
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String |  |  |
| `trigger` | String |  | e.g. LEAD_CREATED, FOLLOWUP_OVERDUE |
| `conditions` | Json | default |  |
| `actions` | Json | default |  |
| `isEnabled` | Boolean | default |  |
| `createdById` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

Indexes/constraints: `@@index([trigger, isEnabled])`

### Notification
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `userId` | String |  |  |
| `channel` | NotificationChannel | default |  |
| `status` | NotificationStatus | default |  |
| `title` | String |  |  |
| `body` | String? |  |  |
| `link` | String? |  |  |
| `dedupeKey` | String? | unique | prevents duplicate notifications |
| `readAt` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([userId, status, createdAt])`

### AuditLog
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `actorId` | String? |  |  |
| `action` | String |  | e.g. lead.reassign, role.permission.change, export.leads |
| `entityType` | String |  |  |
| `entityId` | String? |  |  |
| `before` | Json? |  |  |
| `after` | Json? |  |  |
| `ipAddress` | String? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([entityType, entityId])`; `@@index([actorId, createdAt])`; `@@index([action, createdAt])`

### Counter
| Column | Type | Flags | Notes |
|---|---|---|---|
| `key` | String | PK |  |
| `value` | Int | default |  |

### LeadActivity
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `leadId` | String |  |  |
| `type` | LeadActivityType |  |  |
| `actorId` | String? |  |  |
| `message` | String? |  |  |
| `data` | Json? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([leadId, createdAt])`; `@@index([type, createdAt])`

### ImportBatch
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `fileName` | String |  |  |
| `fileSize` | Int |  |  |
| `uploadedById` | String |  |  |
| `status` | ImportStatus | default |  |
| `headers` | Json |  |  |
| `mapping` | Json? |  |  |
| `campaignId` | String? |  |  |
| `sourceId` | String? |  |  |
| `duplicateStrategy` | DuplicateStrategy | default |  |
| `totalRows` | Int |  |  |
| `processedRows` | Int | default |  |
| `createdCount` | Int | default |  |
| `updatedCount` | Int | default |  |
| `skippedCount` | Int | default |  |
| `failedCount` | Int | default |  |
| `error` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `startedAt` | DateTime? |  |  |
| `completedAt` | DateTime? |  |  |

Indexes/constraints: `@@index([uploadedById, createdAt])`

### ImportRow
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `batchId` | String |  |  |
| `rowNumber` | Int |  | spreadsheet row number (header = row 1) |
| `raw` | Json |  |  |
| `status` | ImportRowStatus | default |  |
| `errors` | Json? |  |  |
| `leadId` | String? |  |  |
| `duplicateOfId` | String? |  |  |

Indexes/constraints: `@@unique([batchId, rowNumber])`; `@@index([batchId, status])`

### SavedView
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `userId` | String |  |  |
| `name` | String |  |  |
| `filters` | Json |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@unique([userId, name])`

### DistributionRule
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `name` | String | unique |  |
| `method` | AssignmentMethod |  | ROUND_ROBIN, EQUAL_DISTRIBUTION, WORKLOAD_BASED, CAMPAIGN_BASED or LOCATION_BASED |
| `isActive` | Boolean | default |  |
| `priority` | Int | default | lower runs first; the first matching rule wins |
| `campaignId` | String? |  |  |
| `sourceId` | String? |  |  |
| `minLeadPriority` | LeadPriority? |  |  |
| `matchCities` | String[] | default |  |
| `matchStates` | String[] | default |  |
| `teamId` | String? |  |  |
| `maxActiveLeads` | Int? |  |  |
| `dailyLimit` | Int? |  |  |
| `fallbackToAny` | Boolean | default | location-based: use any eligible agent if nobody covers the location |
| `cursorUserId` | String? |  | round-robin position |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |
| `archivedAt` | DateTime? |  |  |

Indexes/constraints: `@@index([isActive, priority])`

### DistributionRuleAgent
| Column | Type | Flags | Notes |
|---|---|---|---|
| `ruleId` | String |  |  |
| `userId` | String |  |  |

Indexes/constraints: `@@id([ruleId, userId])`

### DistributionRun
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK |  |
| `actorId` | String |  |  |
| `mode` | String |  | UNASSIGNED or ABSENT_OWNERS |
| `assigned` | Int |  |  |
| `unallocated` | Int |  |  |
| `summary` | Json |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([createdAt])`

### ReassignmentRequest
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `leadId` | String |  |  |
| `fromUserId` | String? |  |  |
| `toUserId` | String |  |  |
| `requestedById` | String |  |  |
| `reason` | String |  |  |
| `status` | ReassignmentStatus | default |  |
| `pendingKey` | String? | unique |  |
| `decidedById` | String? |  |  |
| `decidedAt` | DateTime? |  |  |
| `decisionNote` | String? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([status, createdAt])`; `@@index([leadId])`

### Setting
| Column | Type | Flags | Notes |
|---|---|---|---|
| `key` | String | PK |  |
| `value` | Json |  |  |
| `updatedAt` | DateTime |  |  |

### CallEvent
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `provider` | String |  |  |
| `providerCallId` | String? |  |  |
| `eventType` | String |  |  |
| `dedupeKey` | String | unique |  |
| `raw` | Json |  |  |
| `normalized` | Json? |  |  |
| `status` | CallEventStatus | default |  |
| `attempts` | Int | default |  |
| `note` | String? |  |  |
| `callId` | String? |  |  |
| `receivedAt` | DateTime | default |  |
| `processedAt` | DateTime? |  |  |

Indexes/constraints: `@@index([status, receivedAt])`; `@@index([providerCallId])`; `@@index([callId])`

### AutomationLog
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `ruleId` | String |  |  |
| `dedupeKey` | String | unique |  |
| `trigger` | String |  |  |
| `entityType` | String |  |  |
| `entityId` | String |  |  |
| `status` | String |  | CLAIMED, DONE, FAILED, SKIPPED |
| `attempts` | Int | default |  |
| `result` | Json? |  |  |
| `error` | String? |  |  |
| `createdAt` | DateTime | default |  |
| `updatedAt` | DateTime |  |  |

Indexes/constraints: `@@index([ruleId, createdAt])`; `@@index([status, updatedAt])`

### AttendanceBreak
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `attendanceId` | String |  |  |
| `startedAt` | DateTime | default |  |
| `endedAt` | DateTime? |  |  |

Indexes/constraints: `@@index([attendanceId])`

### CallTranscript
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `callId` | String | unique |  |
| `text` | String |  |  |
| `source` | String |  | "manual" or a provider name |
| `createdById` | String? |  |  |
| `createdAt` | DateTime | default |  |

### CallAnalysis
| Column | Type | Flags | Notes |
|---|---|---|---|
| `id` | String | PK, default |  |
| `callId` | String |  |  |
| `kind` | String |  | "SUMMARY" |
| `result` | Json |  |  |
| `confidence` | Float? |  | as reported by the model; indicative only |
| `model` | String |  |  |
| `status` | AnalysisStatus | default |  |
| `requestedById` | String? |  |  |
| `reviewedById` | String? |  |  |
| `reviewedAt` | DateTime? |  |  |
| `createdAt` | DateTime | default |  |

Indexes/constraints: `@@index([callId, createdAt])`

## Enums

- **UserStatus**: INVITED, ACTIVE, INACTIVE, SUSPENDED
- **PermissionAction**: VIEW, CREATE, EDIT, DELETE, ASSIGN, EXPORT, APPROVE, MANAGE
- **LeadStatus**: NEW, ASSIGNED, ATTEMPTED, CONNECTED, INTERESTED, FOLLOW_UP, QUALIFIED, CONVERTED, LOST, INVALID, DND
- **LeadPriority**: LOW, MEDIUM, HIGH, URGENT
- **AssignmentMethod**: ROUND_ROBIN, EQUAL_DISTRIBUTION, WORKLOAD_BASED, CAMPAIGN_BASED, LOCATION_BASED, MANUAL, REASSIGNMENT
- **AssignmentApproval**: NOT_REQUIRED, PENDING, APPROVED, REJECTED
- **CallDirection**: INBOUND, OUTBOUND
- **CallStatus**: INITIATED, RINGING, IN_PROGRESS, COMPLETED, NOT_ANSWERED, BUSY, FAILED, CANCELED
- **FollowUpStatus**: PENDING, COMPLETED, MISSED, RESCHEDULED, CANCELED
- **TaskStatus**: OPEN, IN_PROGRESS, DONE, CANCELED
- **AttendanceStatus**: PRESENT, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY
- **TargetPeriod**: DAILY, WEEKLY, MONTHLY
- **TargetMetric**: CALL_ATTEMPTS, CONNECTED_CALLS, INTERESTED_LEADS, CONVERSIONS, FOLLOWUPS_COMPLETED
- **NotificationChannel**: IN_APP, EMAIL, SMS, WHATSAPP
- **NotificationStatus**: PENDING, SENT, DELIVERED, FAILED, READ
- **IncentiveStatus**: DRAFT, PENDING_APPROVAL, APPROVED, PAID, REJECTED
- **LeadActivityType**: FOLLOWUP, CREATED, UPDATED, STATUS_CHANGED, NOTE, MERGED, IMPORTED
- **ImportStatus**: MAPPING, VALIDATED, PROCESSING, COMPLETED, FAILED
- **ImportRowStatus**: PENDING, VALID, DUPLICATE, INVALID, CREATED, UPDATED, SKIPPED, FAILED
- **DuplicateStrategy**: UPDATE, SKIP, KEEP_SEPARATE
- **ReassignmentStatus**: PENDING, APPROVED, REJECTED, CANCELED
- **CallEventStatus**: RECEIVED, PROCESSED, IGNORED, FAILED
- **AnalysisStatus**: PENDING_REVIEW, ACCEPTED, REJECTED

## Migrations

No migration files are committed yet. Create them once on a development database and commit them:

```bash
npx prisma migrate dev --name init   # generates prisma/migrations/
git add prisma/migrations
```

Production then uses `npx prisma migrate deploy`. For a throwaway dev/test database `npm run db:push` is enough.
