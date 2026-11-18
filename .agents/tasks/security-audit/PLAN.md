# Implementation Plan: Comprehensive Security Audit and Fixes

## Executive Summary

This telecaller-crm project is a comprehensive Next.js 14 CRM built with TypeScript, Prisma, and PostgreSQL. Per the README, the code **has never been built or run** - static checks passed but real compilation, tests, and runtime are unverified. 

**Critical findings from exploration:**
- 20 TypeScript compilation errors blocking build (rate limiter API mismatch, type mismatches)
- 32 npm security vulnerabilities: 3 critical, 22 high, 7 moderate
  - Next.js 14.2.15: 3 critical RCE vulnerabilities + 8 high (DoS, SSRF, auth bypass)
  - Vitest 2.1.3: 2 critical (RCE, arbitrary file read)
  - Postcss 8.4.47: 2 high (path traversal)
  - Zod 3.23.8: 1 high (DoS)
- Production-readiness gaps: in-memory rate limiter, missing env validation, no error boundaries
- Security implementation is well-designed (bcrypt, sessions, RBAC, Zod validation, Prisma parameterized queries, audit logging, CSP headers) but untested

**Approach:** This work decomposes into 4 sequential features (FEAT-001 through FEAT-004) implementing TypeScript fixes, dependency updates, security enhancements, and comprehensive verification.

---

## FEAT-001: Fix TypeScript Compilation Errors

**Status:** Blocking - must be first
**Files affected:** `lib/rate-limit.ts`, `app/actions/auth.ts`, `tests/phases-9-12.test.ts`, `prisma/seed-demo.ts`, `tests/scope.test.ts`

### Root cause
The `lib/rate-limit.ts` exports `rateLimit(key, limit, windowMs, now?)` returning `{ok: boolean, retryAfterSec: number}`. However, callers in `auth.ts` and tests call it with different signatures and expect different return properties.

### Steps

1. **Analyze rate limiter API** (5 min)
   - Read `lib/rate-limit.ts` lines 1-20
   - Confirm actual signature: `rateLimit(key: string, limit: number, windowMs: number, now?: number)`
   - Confirm return type: `{ok: boolean, retryAfterSec: number}`
   - Note: function `resetRateLimits` exists but is not exported

2. **Fix auth action rate limit calls** (10 min)
   - **File:** `app/actions/auth.ts`
   - **Lines:** 25-27 (loginAction), 44 (forgotPasswordAction)
   - **Current code pattern:**
     ```typescript
     const byIp = rateLimit(`login:ip:${meta.ip ?? "?"}`, 30, 10 * 60_000);
     const byEmail = rateLimit(`login:email:${parsed.data.email}`, 10, 10 * 60_000);
     if (!byIp.ok || !byEmail.ok) return { error: "..." };
     ```
   - **Issue:** This code is correct! The errors may be from stale types.
   - **Action:** Verify calls are correct. If errors persist, regenerate type definitions with `npm run db:generate` and retry typecheck.

3. **Fix test rate limit calls** (15 min)
   - **File:** `tests/phases-9-12.test.ts`
   - **Line 9:** Remove `resetRateLimits` from import or export it in `lib/rate-limit.ts` (function exists line 18)
   - **Lines 185-190:** Update test calls to match actual API
   - **Before:** Multiple errors about wrong arg count and missing properties
   - **After:** Use correct signature `rateLimit(key, limit, windowMs)` and check `.ok` and `.retryAfterSec` properties

4. **Fix seed demo teamId** (5 min)
   - **File:** `prisma/seed-demo.ts`
   - **Line 86:** Type error indicates `teamId: string | null` incompatible with required `string`
   - **Action:** Ensure all seeded users have non-null teamId, or update the type expectation to handle null properly

5. **Fix scope test readonly arrays** (5 min)
   - **File:** `tests/scope.test.ts`
   - **Lines 41-42:** `readonly ["t1"]` cannot be assigned to `string[]`
   - **Action:** Change array literals from `as const` to mutable: `["t1"] as string[]` or wrap in `Array.from()`

6. **Verify fix** (2 min)
   - Run: `npm run typecheck`
   - Expected: Exit 0 with no errors (down from 20 errors)

### Acceptance Criteria
- [ ] `npm run typecheck` passes with 0 errors
- [ ] All rate limiter calls use consistent API
- [ ] Tests compile without import errors
- [ ] Seed script compiles without type mismatches

### Verification
```bash
npm run typecheck
# Must exit 0
```

---

## FEAT-002: Update Dependencies and Resolve Security Vulnerabilities

**Status:** Critical security fixes
**Files affected:** `package.json`, `package-lock.json`, potentially `next.config.mjs`, validation schemas, test files

### Current vulnerabilities breakdown

**Critical (3):**
- Next.js 14.2.15:
  - GHSA-p293-qw3h-jr36: Unauthenticated RCE on Windows servers
  - GHSA-2xp9-vwfh-vxw4: Unauthenticated RCE via AVIF image processing
  - GHSA-2464-fhr4-w9xw: Unauthenticated RCE via SVG image processing
  - GHSA-f82v-jwr5-mffw: Authorization bypass in middleware

**Critical via dependencies (2):**
- Vitest 2.1.3:
  - GHSA-9crc-q9x8-hgqq: RCE when accessing malicious website while API server listening
  - GHSA-5xrq-8626-4rwp: Arbitrary file read and execution via UI server
- Tinypool (via vitest):
  - GHSA-5gmw-xhrv-c9v3: Prototype pollution to RCE
  - GHSA-85c8-ppgw-ccpr: Prototype pollution gadget to RCE

**High (22):**
- Next.js: 8 high severity (DoS, SSRF, middleware bypass)
- Postcss 8.4.47: 2 high (path traversal via sourceMappingURL)
- Zod 3.23.8: 1 high (memory exhaustion DoS)
- Various dev dependencies: glob, picomatch, micromatch, chokidar (mostly dev/build-time risk)

### Update strategy

**Next.js:** Carefully update to latest stable. Check if Next.js 15 is stable or stay on 14.x latest patch. If upgrading to 15, verify React 19 compatibility.

**Approach:**
1. Check Next.js 15 release status and React requirements
2. Option A: Update to Next 15.x (if stable) + React 19
3. Option B: Update to Next 14.x latest patch (if 15 not ready for production)

**Other critical updates:**
- `vitest`: 2.1.3 → 5.1.1 (check for breaking changes)
- `postcss`: 8.4.47 → 8.5.x
- `zod`: 3.23.8 → 3.x latest or 4.x (check breaking changes)

**Additional updates:**
- `eslint`: 8.57.1 → 9.x or 10.x (may need config migration)
- `prisma`: 5.20.0 → 7.x or stay on 5.x stable
- `typescript`: 5.6.3 → 5.7.x (skip 7.0.2 if too new)
- `recharts`: 2.13.0 → 3.11.0
- `bcryptjs`: 2.4.3 → 3.0.3

### Steps

1. **Research breaking changes** (30 min)
   - Check Next.js 15 release notes, migration guide
   - Check Zod 4.x migration if upgrading major version
   - Check Vitest 5.x changes
   - Check ESLint 9/10 flat config requirements
   - Document any required code changes

2. **Update Next.js ecosystem** (15 min)
   ```bash
   npm install next@latest eslint-config-next@latest
   # If Next 15 requires React 19:
   npm install react@latest react-dom@latest @types/react@latest @types/react-dom@latest
   ```
   - Review changes to `next.config.mjs` requirements
   - Check if any API route or middleware patterns changed

3. **Update critical security deps** (10 min)
   ```bash
   npm install postcss@latest vitest@latest
   ```
   - Review vitest config for breaking changes
   - Update test scripts if needed

4. **Update Zod** (10 min)
   ```bash
   npm install zod@latest
   ```
   - If major version bump (3→4), audit all schemas in `validations/`
   - Check for deprecated APIs or schema syntax changes

5. **Update other dependencies** (15 min)
   ```bash
   npm install prisma@latest @prisma/client@latest
   npm run db:generate
   npm install eslint@latest prettier@latest recharts@latest lucide-react@latest
   npm install papaparse@latest tsx@latest autoprefixer@latest
   npm install tailwindcss@latest tailwind-merge@latest
   npm install bcryptjs@latest @types/bcryptjs@latest
   npm install typescript@latest
   ```
   - Check TypeScript version compatibility (stay on 5.7 if 7.x too new)
   - Check Prisma schema changes needed

6. **Update package versions conservatively** (alt approach)
   - Instead of `@latest`, specify exact safe versions:
     - `next@15.0.x` or `next@14.2.x` (whichever is patched)
     - `vitest@5.x.x` (not 5.1.1 if unstable)
   - This avoids pulling in cutting-edge versions

7. **Check for breaking changes** (30 min)
   - Review all updated package changelogs
   - ESLint 9/10: May need to migrate to flat config
   - Next.js 15: Check middleware, route handlers, server actions changes
   - Zod 4: Check schema API changes
   - Update code as needed

8. **Verify vulnerability resolution** (5 min)
   ```bash
   npm audit
   ```
   - Expected: Critical and high counts reduced to 0 (or near 0)
   - Document any remaining moderate/low issues

9. **Verify build still works** (5 min)
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
   - Fix any new type errors from updated dependencies
   - Fix any lint errors from updated ESLint

### Acceptance Criteria
- [ ] `npm audit` reports 0 critical and 0 high severity vulnerabilities
- [ ] Next.js updated to secure version (no RCE vulnerabilities)
- [ ] Vitest updated to secure version (no RCE vulnerabilities)
- [ ] Postcss, Zod, and other packages updated
- [ ] Application compiles with `npm run build`
- [ ] All type checks pass with `npm run typecheck`
- [ ] Linter passes with `npm run lint`

### Verification
```bash
npm audit --json | jq '.metadata.vulnerabilities | {critical, high}'
# Expected: {"critical": 0, "high": 0}

npm run typecheck && npm run lint && npm run build
# All must succeed
```

---

## FEAT-003: Production-Ready Security Enhancements

**Status:** Enhancements to existing security foundation
**Files affected:** Multiple new files, updates to configs and docs

### Current security state (already good)

**Strong existing security:**
- ✅ Authentication: Session-based with httpOnly cookies, SHA-256 token hashing, bcrypt cost 12
- ✅ Authorization: RBAC with 8 roles, data scoping (own/team/all), service-layer enforcement
- ✅ Input validation: Zod schemas on all actions/routes, Prisma parameterized queries
- ✅ Password policy: 10-128 chars, upper/lower/digit, account lockout after 5 failures
- ✅ Secrets management: Logger redacts passwords/tokens/secrets, never sent to client
- ✅ Security headers: CSP, HSTS (prod), X-Frame-Options, X-Content-Type-Options
- ✅ Audit logging: Append-only audit log for sensitive actions
- ✅ Webhook security: Constant-time secret comparison, optional IP allowlist, HMAC

**Known gaps (from docs/SECURITY.md caveats):**
- ⚠️ Rate limiting is in-process (each instance counts separately)
- ⚠️ CSP allows 'unsafe-inline' scripts (Next.js hydration requirement)
- ⚠️ No MFA, no SSO
- ⚠️ No production-grade monitoring/alerting

### Enhancement goals

1. **Rate limiter improvement:** Add Redis-based option while keeping in-memory for dev
2. **Environment validation:** Comprehensive startup checks for all secrets
3. **Database connection pooling:** Explicit production configuration
4. **Error boundaries:** Client-side error handling
5. **API rate limiting:** Protect resource-intensive routes
6. **Security.txt:** RFC 9116 security contact file
7. **Monitoring hooks:** Prepare for observability
8. **Documentation:** Update security docs with new mitigations

### Steps

1. **Add Redis-based rate limiter** (45 min)
   - **Create:** `lib/rate-limit-redis.ts`
   - Implement same interface as `lib/rate-limit.ts` but using Redis
   - Use `ioredis` package (add dependency)
   - Store sliding window in Redis sorted sets
   - Pattern:
     ```typescript
     export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ok: boolean, retryAfterSec: number}> {
       if (!redis) return inMemoryFallback(key, limit, windowMs);
       // Use ZADD with NX, ZREMRANGEBYSCORE, ZCARD for sliding window
     }
     ```
   - **Update:** `app/actions/auth.ts` to use Redis limiter when `REDIS_URL` set
   - **Update:** `lib/rate-limit.ts` comments to clarify in-memory limitations
   - **Update:** `docs/SECURITY.md` to document Redis option
   - **Add to package.json:** `ioredis@latest`

2. **Enhance environment validation** (30 min)
   - **Update:** `lib/env.ts`
   - Add validation for:
     - `CRON_SECRET`: required if using cron, min 24 chars
     - `EXOTEL_WEBHOOK_SECRET`: required if TELEPHONY_PROVIDER set, min 24 chars
     - `REDIS_URL`: optional but validate URL format if set
   - Pattern:
     ```typescript
     const schema = z.object({
       // ... existing fields
       CRON_SECRET: z.string().min(24).optional().refine(val => {
         if (process.env.NODE_ENV === 'production' && !val) {
           console.warn('CRON_SECRET not set - scheduler endpoint will refuse requests');
         }
         return true;
       }),
       // Similar for other secrets
     });
     ```
   - Make validation fail fast in production if critical secrets missing
   - **Update:** `.env.example` with better documentation

3. **Configure database connection pooling** (20 min)
   - **Update:** `lib/db.ts`
   - Add explicit pool configuration:
     ```typescript
     export const db = new PrismaClient({
       log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
       datasources: {
         db: {
           url: process.env.DATABASE_URL,
         },
       },
       // Connection pool for production
       ...(process.env.NODE_ENV === "production" && {
         connection_limit: 20, // Adjust based on deployment
         pool_timeout: 20,
       }),
     });
     ```
   - **Update:** `.env.example` to document connection pool params in DATABASE_URL
   - **Update:** `docs/DEPLOYMENT.md` with recommended pool sizes

4. **Add error boundaries** (30 min)
   - **Create:** `app/error.tsx` (root-level error boundary)
     ```typescript
     'use client';
     export default function GlobalError({ error, reset }: { error: Error, reset: () => void }) {
       // Log error without exposing stack trace
       // Show user-friendly error page
     }
     ```
   - **Create:** `app/(app)/error.tsx` (authenticated section boundary)
   - Follow Next.js 14/15 error boundary conventions
   - Log errors server-side via `lib/logger.ts`
   - Never expose stack traces to client
   - **Note:** `app/(admin)/dashboard/error.tsx` already exists

5. **Improve CSP** (30 min)
   - **Research:** Next.js 15 nonce support for inline scripts
   - **If supported:**
     - Update `next.config.mjs` to generate and use nonces
     - Remove `'unsafe-inline'` from script-src
     - Test that hydration still works
   - **If not supported:**
     - Document in `docs/SECURITY.md` why CSP cannot be stricter
     - Explain Next.js hydration requirement
     - Note alternative: consider using Partytown for third-party scripts (if applicable)

6. **Add security.txt** (15 min)
   - **Create:** `public/.well-known/security.txt`
   - Follow RFC 9116 format:
     ```
     Contact: mailto:security@example.com
     Expires: 2025-12-31T23:59:59Z
     Preferred-Languages: en
     ```
   - **Update:** `docs/SECURITY.md` with contact policy
   - Verify file is served at `/.well-known/security.txt` in dev/prod

7. **Add API route rate limiting** (45 min)
   - **Create:** `lib/api-rate-limit.ts` (middleware wrapper)
     ```typescript
     export function withRateLimit(limit: number, windowMs: number) {
       return async (req: Request, handler: Function) => {
         const key = `api:${getClientIP(req)}:${new URL(req.url).pathname}`;
         const check = await rateLimit(key, limit, windowMs);
         if (!check.ok) {
           return NextResponse.json(
             { error: { code: "RATE_LIMITED", message: "Too many requests" } },
             { status: 429, headers: { "Retry-After": String(check.retryAfterSec) } }
           );
         }
         return handler(req);
       };
     }
     ```
   - **Apply to routes:**
     - `app/api/leads/import/route.ts`: 10 req/hour
     - `app/api/leads/export/route.ts`: 20 req/hour
     - `app/api/reports/[type]/export/route.ts`: 20 req/hour
     - `app/api/auth/me/route.ts`: 100 req/minute
   - Pattern: Wrap existing route handlers with rate limit middleware

8. **Add monitoring helpers** (30 min)
   - **Create:** `lib/metrics.ts`
   - Provide hooks for prometheus-style metrics (no-op if not configured):
     ```typescript
     export const metrics = {
       recordDbQuery: (duration: number) => { /* no-op or send to collector */ },
       recordRateLimit: (key: string, allowed: boolean) => { /* ... */ },
       recordSessionCount: () => { /* ... */ },
     };
     ```
   - Make it easy to add monitoring later without changing core code
   - Document in `docs/DEPLOYMENT.md`

9. **Update documentation** (30 min)
   - **Update:** `docs/SECURITY.md`
     - Document Redis rate limiter option
     - Update CSP caveat based on improvement feasibility
     - Add section on API rate limiting
     - Update production checklist
   - **Update:** `docs/PRODUCTION_CHECKLIST.md`
     - Add environment validation requirements
     - Add Redis setup steps
     - Add monitoring setup guidance
   - **Update:** `docs/DEPLOYMENT.md`
     - Add database pool configuration
     - Add Redis deployment notes

### Acceptance Criteria
- [ ] Redis-based rate limiter available and used when REDIS_URL configured
- [ ] Environment validation covers all security-critical variables
- [ ] Database connection pool explicitly configured
- [ ] Error boundaries catch client-side errors without exposing internals
- [ ] CSP improved if feasible, constraints documented if not
- [ ] security.txt file exists and is accessible
- [ ] Sensitive API routes have rate limiting applied
- [ ] Monitoring hooks ready for future observability
- [ ] Documentation reflects all enhancements and tradeoffs

### Verification
```bash
npm run typecheck && npm run build
# Must succeed

# Verify error boundaries exist
ls app/error.tsx app/(app)/error.tsx

# Test security.txt (after starting dev server)
npm run dev &
sleep 5
curl http://localhost:3000/.well-known/security.txt
# Should return security contact info

# Verify env validation
unset AUTH_SECRET
npm run build
# Should fail with clear error about missing AUTH_SECRET
```

---

## FEAT-004: Verification, Testing, and Documentation

**Status:** Final validation and documentation
**Files affected:** Test files, documentation, verification reports

### Goal
Establish baseline of what actually works after fixes and updates. The README states code has never been built or run, so this feature validates everything and documents the results.

### Verification checklist

**Build verification:**
- [x] TypeScript compilation (`npm run typecheck`)
- [ ] Linter (`npm run lint`)
- [ ] Unit tests (`npm test`)
- [ ] Integration tests (`npm run test:integration` with TEST_DATABASE_URL)
- [ ] Production build (`npm run build`)
- [ ] Dev server starts (`npm run dev`)

**Security verification:**
- [ ] Login with wrong password → account locks after 5 attempts
- [ ] Password reset flow → token is single-use, expires in 1 hour
- [ ] Rate limiting → rapid login attempts are blocked
- [ ] Session expiry → re-authentication required after idle timeout
- [ ] Deactivated user → cannot login
- [ ] CSRF protection → server actions validate origin
- [ ] Secrets in logs → are redacted (check console output)
- [ ] SQL injection → lead search with quotes/SQL safely escaped
- [ ] XSS → lead notes with `<script>` tags are escaped
- [ ] Authorization → out-of-scope lead IDs return 404, not 403

**Runtime verification:**
- [ ] Application starts without errors
- [ ] Login as admin@crm.test works with SEED_DEV_PASSWORD
- [ ] Dashboard loads and renders
- [ ] Leads page works
- [ ] Team page works
- [ ] No console errors in browser

### Steps

1. **Run full build verification** (10 min)
   ```bash
   npm run verify
   ```
   - This runs: `prisma generate && tsc --noEmit && next lint && vitest run && next build`
   - Fix any remaining issues discovered
   - Document results

2. **Run integration tests** (if TEST_DATABASE_URL available) (15 min)
   ```bash
   # Set up throwaway test database
   export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
   npm run test:integration
   ```
   - Document results (pass/fail counts)
   - If no test DB available, document as "SKIPPED - no test database configured"

3. **Manual security testing** (60 min)
   - Start dev server: `npm run dev`
   - Run through security checklist above
   - Document findings for each item:
     - ✅ PASS: Works as expected
     - ⚠️ ISSUE: Found problem (describe)
     - ⏭️ SKIP: Cannot test (explain why)

4. **Runtime smoke test** (15 min)
   ```bash
   npm run dev
   # In browser:
   # 1. Go to http://localhost:3000
   # 2. Login as admin@crm.test
   # 3. Navigate to /dashboard, /leads, /team, /settings
   # 4. Check browser console for errors
   # 5. Try creating a lead, searching leads
   # 6. Check that actions work (not just UI)
   ```
   - Document any runtime errors
   - Note what works and what doesn't

5. **Create verification results document** (30 min)
   - **Create:** `.agents/tasks/security-audit/verification-results.md`
   - Structure:
     ```markdown
     # Security Audit Verification Results
     
     ## Build Verification
     - TypeScript: [PASS/FAIL] - [details]
     - Linter: [PASS/FAIL] - [details]
     - Unit tests: [X/Y passed] - [details]
     - Integration tests: [X/Y passed] - [details]
     - Production build: [PASS/FAIL] - [details]
     
     ## Security Testing
     [For each item in checklist: status and findings]
     
     ## Runtime Verification
     [What works, what doesn't, errors encountered]
     
     ## Remaining Known Limitations
     [From docs/SECURITY.md]
     
     ## Recommendations
     - [ ] Penetration testing by security firm
     - [ ] Load testing with realistic volumes
     - [ ] Accessibility audit with assistive technologies
     - [ ] Set up production monitoring
     - [ ] Configure Redis for rate limiting
     - [ ] Enable MFA for admin accounts
     ```

6. **Create changes summary** (30 min)
   - **Create:** `.agents/tasks/security-audit/CHANGES.md`
   - Structure:
     ```markdown
     # Security Audit Changes Summary
     
     ## FEAT-001: TypeScript Fixes
     - Fixed [N] compilation errors
     - Files changed: [list]
     - Details: [summary]
     
     ## FEAT-002: Dependency Updates
     - Updated [N] packages
     - Resolved [N] vulnerabilities (X critical, Y high)
     - Key updates:
       - next: 14.2.15 → [version]
       - vitest: 2.1.3 → [version]
       - [etc]
     - Breaking changes: [list or "none"]
     
     ## FEAT-003: Security Enhancements
     - Added Redis-based rate limiter
     - Enhanced environment validation
     - Configured database pooling
     - Added error boundaries
     - [etc]
     
     ## FEAT-004: Verification Results
     - Build: [status]
     - Tests: [pass/fail counts]
     - Security checks: [summary]
     
     ## Migration Notes
     - Environment variables: [new requirements]
     - Database: [any schema changes]
     - Deployment: [new considerations]
     ```

7. **Update TESTING.md** (15 min)
   - **Update:** `docs/TESTING.md`
   - Change "never run" to actual status:
     - "Build: PASS/FAIL on [date]"
     - "Unit tests: X/Y passed"
     - "Integration tests: X/Y passed or SKIPPED"
   - Add section "Last verification: [date] - see .agents/tasks/security-audit/"

8. **Run final audit** (5 min)
   ```bash
   npm audit
   ```
   - Document any remaining vulnerabilities
   - For each moderate/low issue, note:
     - CVE ID
     - Affected package
     - Exploitability in this context
     - Plan to address or accept risk

9. **Test dev server functionality** (20 min)
   - Run seed: `npm run db:seed` (if not already done)
   - Start server: `npm run dev`
   - Test complete user journey:
     1. Login with `admin@crm.test` and SEED_DEV_PASSWORD
     2. Navigate all accessible pages
     3. Create a test lead
     4. Search for the lead
     5. Edit the lead
     6. Check audit log for recorded actions
     7. Test logout
   - Document functionality status

### Acceptance Criteria
- [ ] `npm run verify` completes successfully
- [ ] `npm run build` produces production bundle
- [ ] `npm test` passes (or failures documented)
- [ ] Integration tests pass or documented as skipped
- [ ] Security checklist completed with results
- [ ] Dev server starts and basic pages work
- [ ] verification-results.md created with complete findings
- [ ] CHANGES.md created with all modifications documented
- [ ] docs/TESTING.md updated with actual status
- [ ] All issues found are documented with severity and plan

### Verification
```bash
# Must all succeed or be documented as skipped with reason
npm run verify
npm run build
npm run dev  # Manual check that it starts

# Documentation must exist
ls .agents/tasks/security-audit/verification-results.md
ls .agents/tasks/security-audit/CHANGES.md

# TESTING.md must be updated
grep "Last verification" docs/TESTING.md
```

---

## Summary

This plan decomposes the security audit into 4 sequential features:

1. **FEAT-001:** Fix TypeScript errors (blocking, ~30 min)
2. **FEAT-002:** Update dependencies (critical, ~2 hours)
3. **FEAT-003:** Production enhancements (~4 hours)
4. **FEAT-004:** Verification and documentation (~3 hours)

**Total estimated effort:** ~9-10 hours

**Key principle:** Each feature leaves the codebase in a buildable, testable state. Commit after each feature.

**Constraints respected:**
- No breaking changes to functionality
- Maintain backward compatibility where possible
- Preserve database schema (no migrations unless absolutely necessary)
- Keep environment variable structure (add validation, don't change vars)
- Document all changes and tradeoffs

**Risk mitigation:**
- TypeScript fixes first to unblock compilation
- Dependency updates carefully checked for breaking changes
- Security enhancements are additive (don't remove existing protections)
- Comprehensive verification catches any issues introduced

**Success criteria:**
- All TypeScript errors resolved
- All critical/high CVEs resolved
- Application builds and starts successfully
- Security implementations verified working
- Complete documentation of changes and verification results
