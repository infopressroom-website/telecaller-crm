# Implementation Plan: Complete Roadmap Features

This plan implements all missing features from IMPLEMENTATION_ROADMAP.md Phase 2-6. The work is organized into 7 features (FEAT-001 through FEAT-007) that must be implemented sequentially due to dependencies.

## Implementation Order & Rationale

**Order:** Database → Caching → Real-time → Email → API → Storage → Polish

**Rationale:**
1. **FEAT-001 (Database Indexes)** first - zero-risk performance improvement, no dependencies
2. **FEAT-002 (Redis Caching)** - depends on indexes for optimal query performance
3. **FEAT-003 (Real-time Pusher)** - independent but benefits from cached data
4. **FEAT-004 (Email Service)** - independent, can run parallel to FEAT-003
5. **FEAT-005 (REST API)** - depends on all services working well
6. **FEAT-006 (S3 Storage)** - large files benefit from prior optimizations
7. **FEAT-007 (Polish & Docs)** - final integration and documentation

## Feature Checklist

### FEAT-001: Database Performance Indexes ⚡
**Priority:** HIGH | **Time:** 2-3 hours | **Risk:** LOW

- [ ] Add composite indexes to Lead model for filtered lists
- [ ] Add composite indexes to CallLog for reports
- [ ] Add composite indexes to FollowUp for priority queues
- [ ] Add composite indexes to User for distribution
- [ ] Add composite indexes to Notification for inbox queries
- [ ] Generate and apply migration
- [ ] Verify with prisma validate

**Files:**
- `prisma/schema.prisma` - add @@index directives

**Verify:** `npx prisma migrate dev --name add-composite-indexes && npm run test`

---

### FEAT-002: Redis Caching Integration 🚀
**Priority:** HIGH | **Time:** 4-6 hours | **Risk:** LOW

- [ ] Verify Redis client setup (lib/redis.ts)
- [ ] Add caching to dashboard-service.ts (metrics, activity)
- [ ] Add caching to report-service.ts (report results)
- [ ] Add caching to lead-service.ts (counts, lists)
- [ ] Add cache invalidation on data changes
- [ ] Add Redis health check to /api/health
- [ ] Write cache tests
- [ ] Update documentation

**Files:**
- `services/dashboard-service.ts` - wrap getMetrics(), getRecentActivity()
- `services/report-service.ts` - cache report results
- `services/lead-service.ts` - cache counts, invalidate on changes
- `services/call-service.ts` - invalidate dashboard cache
- `.env.example` - document REDIS_URL
- `tests/cache.test.ts` - test caching behavior

**Verify:** Start app with/without Redis, verify graceful fallback, check response times

---

### FEAT-003: Real-time Notifications via Pusher 📡
**Priority:** HIGH | **Time:** 6-8 hours | **Risk:** MEDIUM

- [ ] Install pusher and pusher-js packages
- [ ] Add Pusher env vars to .env.example and lib/env.ts
- [ ] Update notification-service.ts to trigger Pusher events
- [ ] Create /api/pusher/auth for channel authentication
- [ ] Add real-time listeners to notification UI
- [ ] Add real-time listener to app shell notification bell
- [ ] Add Pusher health check
- [ ] Write integration tests
- [ ] Document setup

**Files:**
- `services/notification-service.ts` - call notifyUser() after creating notification
- `app/api/pusher/auth/route.ts` - new file for channel auth
- `app/(app)/notifications/page.tsx` - add useUserEvents hook
- `components/app-shell.tsx` - real-time notification bell
- `.env.example` - PUSHER_* variables
- `lib/env.ts` - validate Pusher env vars
- `tests/integration/realtime.int.test.ts` - test Pusher events

**Verify:** Open two browser tabs, create notification, verify instant update

---

### FEAT-004: Email Service Integration 📧
**Priority:** MEDIUM | **Time:** 4-6 hours | **Risk:** LOW

- [ ] Install resend package
- [ ] Add email env vars (RESEND_API_KEY, EMAIL_FROM)
- [ ] Wire sendPasswordResetEmail into auth-service.ts
- [ ] Wire sendWelcomeEmail into user creation
- [ ] Create email notification service for automation
- [ ] Create /settings/email test page
- [ ] Add email health check
- [ ] Write email tests
- [ ] Update deployment guide with Resend setup

**Files:**
- `services/auth-service.ts` - call sendPasswordResetEmail()
- `services/employee-service.ts` - call sendWelcomeEmail()
- `services/email-notification-service.ts` - new file
- `app/(app)/settings/email/page.tsx` - new file for testing
- `.env.example` - RESEND_API_KEY, EMAIL_FROM
- `lib/env.ts` - validate email env vars
- `tests/email.test.ts` - test email sending

**Verify:** Request password reset, verify email arrives (or logged in dev)

---

### FEAT-005: REST API Endpoints 🔌
**Priority:** MEDIUM | **Time:** 8-12 hours | **Risk:** MEDIUM

- [ ] Add apiKey fields to User model (migration)
- [ ] Create lib/api-auth.ts for Bearer token authentication
- [ ] Create lib/api-response.ts for standardized responses
- [ ] Create /settings/api-tokens UI for token management
- [ ] Create /api/v1/me endpoint
- [ ] Create /api/v1/leads endpoints (CRUD + list)
- [ ] Create /api/v1/calls endpoints
- [ ] Create /api/v1/follow-ups endpoints
- [ ] Create /api/v1/notifications endpoints
- [ ] Write API documentation (docs/API.md)
- [ ] Write integration tests for all endpoints
- [ ] Update README with API section

**Files:**
- `prisma/schema.prisma` - add apiKey, apiKeyHash to User
- `lib/api-auth.ts` - new file
- `lib/api-response.ts` - new file
- `app/(app)/settings/api-tokens/page.tsx` - new file
- `app/api/v1/me/route.ts` - new file
- `app/api/v1/leads/route.ts` - new file
- `app/api/v1/leads/[id]/route.ts` - new file
- `app/api/v1/calls/route.ts` - new file
- `app/api/v1/follow-ups/route.ts` - new file
- `app/api/v1/notifications/route.ts` - new file
- `docs/API.md` - comprehensive API documentation
- `tests/integration/api.int.test.ts` - test all endpoints

**Verify:** Generate token, test all endpoints with curl, verify rate limiting

---

### FEAT-006: S3 File Storage 📁
**Priority:** MEDIUM | **Time:** 8-10 hours | **Risk:** MEDIUM

- [ ] Install AWS SDK packages
- [ ] Add AWS/storage env vars
- [ ] Create lib/storage.ts adapter interface
- [ ] Implement S3 storage adapter
- [ ] Implement local filesystem adapter
- [ ] Update call recording storage
- [ ] Update import file storage
- [ ] Update export file storage
- [ ] Create cleanup cron job
- [ ] Add storage health check
- [ ] Write storage tests
- [ ] Update deployment guide with S3 setup

**Files:**
- `lib/storage.ts` - new file, main interface
- `lib/storage/s3.ts` - new file, S3 implementation
- `lib/storage/local.ts` - new file, local implementation
- `services/call-service.ts` - use storage for recordings
- `app/api/leads/import/route.ts` - store uploaded files
- `app/api/leads/export/route.ts` - store exports
- `app/api/reports/[type]/export/route.ts` - store exports
- `app/api/storage/cleanup/route.ts` - new file, cleanup job
- `.env.example` - AWS_*, STORAGE_PROVIDER
- `lib/env.ts` - validate storage env vars
- `tests/storage.test.ts` - test both adapters

**Verify:** Upload file, download via presigned URL, verify cleanup job

---

### FEAT-007: Environment Config & Documentation Polish 📝
**Priority:** MEDIUM | **Time:** 6-8 hours | **Risk:** LOW

- [ ] Review and finalize .env.example
- [ ] Verify all env vars in lib/env.ts
- [ ] Verify toast notifications across all pages
- [ ] Polish API token management UI
- [ ] Create real-time status indicator component
- [ ] Update IMPLEMENTATION_ROADMAP.md (mark complete)
- [ ] Update README.md with new features
- [ ] Create comprehensive API documentation (docs/API.md)
- [ ] Create Redis documentation (docs/REDIS.md)
- [ ] Create Storage documentation (docs/STORAGE.md)
- [ ] Update DEPLOYMENT_GUIDE.md with all services
- [ ] Run full verification (npm run verify)
- [ ] Create CHANGELOG.md

**Files:**
- `.env.example` - final review
- `lib/env.ts` - final review
- `app/(app)/settings/api-tokens/page.tsx` - polish UI
- `components/realtime-status.tsx` - new file
- `IMPLEMENTATION_ROADMAP.md` - update status
- `README.md` - update features
- `docs/API.md` - new file
- `docs/REDIS.md` - new file
- `docs/STORAGE.md` - new file
- `docs/DEPLOYMENT_GUIDE.md` - update
- `CHANGELOG.md` - new file

**Verify:** `npm run verify` passes, all documentation accurate

---

## Dependencies Between Features

```
FEAT-001 (Indexes)
    ↓
FEAT-002 (Redis) ← benefits from indexes
    ↓
FEAT-003 (Pusher) ← can use cached data
FEAT-004 (Email) ← independent
    ↓
FEAT-005 (API) ← needs all services working
    ↓
FEAT-006 (Storage) ← benefits from optimizations
    ↓
FEAT-007 (Polish) ← integrates everything
```

**Critical Path:** 1 → 2 → 5 → 6 → 7  
**Parallel:** 3 and 4 can run parallel to 2

---

## Testing Strategy

### Unit Tests (tests/)
- Cache behavior (with/without Redis)
- Email sending (mocked Resend)
- Storage adapters (S3 + local)
- API authentication
- API response formatting

### Integration Tests (tests/integration/)
- Real-time event delivery (mocked Pusher)
- API endpoints (full request/response)
- Storage upload/download flow
- Email delivery flow

### Manual Testing
- Two-browser real-time notification test
- Email delivery with actual Resend account
- S3 upload with actual AWS credentials
- API testing with curl/Postman
- Performance testing (dashboard load times)

### Verification Commands
```bash
npm run test              # Unit tests
npm run test:all          # Unit + integration
npm run typecheck         # TypeScript
npm run lint              # ESLint
npm run build             # Production build
npm run verify            # All of the above
```

---

## Rollback Considerations

### FEAT-001 (Indexes)
**Rollback:** Drop indexes with `prisma migrate resolve --rolled-back MIGRATION_ID`  
**Risk:** LOW - indexes are additive, no data changes

### FEAT-002 (Redis)
**Rollback:** Remove Redis integration, fallback already built-in  
**Risk:** NONE - graceful degradation

### FEAT-003 (Pusher)
**Rollback:** Remove Pusher calls, app works without real-time  
**Risk:** NONE - graceful degradation

### FEAT-004 (Email)
**Rollback:** Remove email calls, console logging remains  
**Risk:** NONE - graceful degradation

### FEAT-005 (API)
**Rollback:** Delete /api/v1/ directory, drop apiKey columns  
**Risk:** LOW - web app unaffected

### FEAT-006 (Storage)
**Rollback:** Switch STORAGE_PROVIDER to 'local'  
**Risk:** MEDIUM - files in S3 would be orphaned (keep migration)

### FEAT-007 (Polish)
**Rollback:** Revert documentation changes  
**Risk:** NONE - documentation only

---

## Success Criteria

### Phase 2.1 ✅ Database Indexes
- [ ] All indexes applied without errors
- [ ] Dashboard loads <500ms (was 2s)
- [ ] Report generation 50% faster

### Phase 2.2 ✅ Redis Caching
- [ ] Redis connected (or memory fallback works)
- [ ] Cache hit rate >70% for dashboard
- [ ] Dashboard TTL working (2min refresh)

### Phase 3.1 & 3.2 ✅ Real-time
- [ ] Notifications arrive instantly (<1 second)
- [ ] Works in multiple tabs simultaneously
- [ ] Graceful degradation without Pusher

### Phase 4.1 & 4.2 ✅ Email
- [ ] Password reset emails delivered
- [ ] Welcome emails delivered
- [ ] Email templates well-formatted
- [ ] Test email page works

### Phase 5.1 ✅ REST API
- [ ] All v1 endpoints functional
- [ ] Bearer token auth working
- [ ] Rate limiting enforced
- [ ] API documentation complete

### Phase 6.1 ✅ File Storage
- [ ] Files stored in S3 (or local)
- [ ] Presigned URLs working
- [ ] Cleanup job removes old files
- [ ] Large files (>50MB) work

### Overall Success
- [ ] `npm run verify` passes 100%
- [ ] All features documented
- [ ] No regression in existing features
- [ ] Performance improved (25%+ faster)
- [ ] Deployment guide updated

---

## Estimated Timeline

| Feature | Time Estimate | Risk Level |
|---------|--------------|------------|
| FEAT-001 Database Indexes | 2-3 hours | LOW |
| FEAT-002 Redis Caching | 4-6 hours | LOW |
| FEAT-003 Real-time Pusher | 6-8 hours | MEDIUM |
| FEAT-004 Email Service | 4-6 hours | LOW |
| FEAT-005 REST API | 8-12 hours | MEDIUM |
| FEAT-006 S3 Storage | 8-10 hours | MEDIUM |
| FEAT-007 Polish & Docs | 6-8 hours | LOW |
| **Total** | **38-53 hours** | **5-7 days** |

**Buffer:** Add 20% for testing and unexpected issues = **6-8 days total**

---

## Notes

- All features have graceful degradation (Redis, Pusher, Email, S3 all optional)
- Existing functionality must not break
- TypeScript strict mode enforced
- All changes must pass `npm run verify`
- Follow existing code patterns (services layer, Zod validation, etc.)
- Environment variables must be documented in .env.example AND lib/env.ts
- Server-side code must import 'server-only'
- Security: rate limiting, input validation, authentication on all API endpoints

---

## Digest

### Files to Modify

**prisma/schema.prisma** (lines 235-940)
- Add composite indexes to Lead, CallLog, FollowUp, User, LeadAssignment, Notification models
- Add apiKey, apiKeyHash fields to User model (lines 173-238)
- Tests: `npx prisma validate` passes

**services/dashboard-service.ts** (lines 1-200)
- Wrap getMetrics() with cacheGet/cacheSet using key `dashboard:metrics:{userId}` TTL 120sec
- Wrap getRecentActivity() with cache key `dashboard:activity:{userId}:{limit}` TTL 60sec
- Tests: tests/cache.test.ts

**services/report-service.ts** (lines 1-300)
- Cache generateLeadReport with key `report:leads:{userId}:{hash}` TTL 300sec
- Cache generateCallReport with key `report:calls:{userId}:{hash}` TTL 300sec
- Tests: tests/cache.test.ts

**services/lead-service.ts** (lines 1-500)
- Cache getLeadCounts() with key `leads:counts:{userId}` TTL 60sec
- Invalidate in createLead/updateLead/deleteLead with cacheDelPattern('leads:counts:*')
- Tests: tests/lead-service.test.ts passes

**services/call-service.ts** (lines 1-400)
- Invalidate dashboard cache in completeCall() with cacheDelPattern('dashboard:*')
- Add storage.uploadFile() for recordings when webhook received
- Tests: tests/call-service.test.ts passes

**services/notification-service.ts** (lines 1-50)
- After db.notification.create(), call notifyUser(n.userId, 'notification.created', notification)
- Import { notifyUser, RealtimeEvents } from '@/lib/pusher-server'
- Tests: tests/integration/realtime.int.test.ts

**services/auth-service.ts** (lines 55-75)
- In requestPasswordReset(), call await sendPasswordResetEmail(email, link)
- Import { sendPasswordResetEmail } from '@/lib/email'
- Tests: tests/email.test.ts

**.env.example** (entire file)
- Add REDIS_URL, PUSHER_*, RESEND_API_KEY, EMAIL_FROM, AWS_*, STORAGE_PROVIDER
- Clear comments explaining setup and optional nature
- Tests: manual verification

**lib/env.ts** (lines 1-150)
- Add all new env vars to envSchema with proper validation
- Update features object to include redis, pusher, email, storage
- Tests: app starts successfully, env validation works

**app/api/health/route.ts** (lines 1-30)
- Add redis, pusher, email, storage status checks
- Import isRedisAvailable, isPusherAvailable, etc.
- Tests: curl http://localhost:3000/api/health returns status

### Files to Create

**app/api/pusher/auth/route.ts** - Pusher channel authentication  
**app/api/v1/me/route.ts** - API user profile  
**app/api/v1/leads/route.ts** - API leads list/create  
**app/api/v1/leads/[id]/route.ts** - API leads detail/update/delete  
**app/api/v1/calls/route.ts** - API calls list/create  
**app/api/v1/follow-ups/route.ts** - API follow-ups  
**app/api/v1/notifications/route.ts** - API notifications  
**app/api/storage/cleanup/route.ts** - Storage cleanup cron  
**app/(app)/settings/api-tokens/page.tsx** - API token management UI  
**app/(app)/settings/email/page.tsx** - Email testing UI  
**lib/api-auth.ts** - API authentication  
**lib/api-response.ts** - API response helpers  
**lib/storage.ts** - Storage interface  
**lib/storage/s3.ts** - S3 implementation  
**lib/storage/local.ts** - Local filesystem implementation  
**services/email-notification-service.ts** - Email automation  
**components/realtime-status.tsx** - Real-time indicator  
**docs/API.md** - API documentation  
**docs/REDIS.md** - Redis documentation  
**docs/STORAGE.md** - Storage documentation  
**CHANGELOG.md** - Version 1.1.0 release notes  
**tests/cache.test.ts** - Cache tests  
**tests/email.test.ts** - Email tests  
**tests/storage.test.ts** - Storage tests  
**tests/integration/realtime.int.test.ts** - Real-time tests  
**tests/integration/api.int.test.ts** - API tests

### Verification Commands Used

- `npx prisma validate` - verify schema
- `npx prisma migrate dev` - apply migrations
- `npm run test` - unit tests
- `npm run test:all` - unit + integration tests
- `npm run verify` - full verification (typecheck + lint + test + build)
- `curl http://localhost:3000/api/health` - health check
- Manual: two-browser real-time test, email delivery test, S3 upload test, API curl test
