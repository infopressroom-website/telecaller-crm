# Architecture — Phase 01

## Layers (dependencies point downward only)

| Layer | Folder | Responsibility |
|---|---|---|
| UI routes | `app/` | Pages, layouts, thin API route handlers |
| UI components | `components/` | Reusable, presentation-only components |
| Feature modules | `features/<name>/` | Feature-specific UI, hooks and server actions |
| Services | `services/` | Business logic and DB access. **The only layer that talks to Prisma.** |
| Validation | `validations/` | Zod schemas shared by client forms and server handlers |
| Shared lib | `lib/` | `db`, `env`, `errors`, `api` wrapper, `pagination`, `permissions` |

Rules:
- Route handlers only parse input (Zod), call a service, and return `ok(...)`; wrap with `route()` for uniform errors.
- Authorization is enforced in services (Phase 03), never only in the UI.
- Secrets are read through `lib/env.ts` on the server only.

## API conventions
Success: `{ "data": ... }`. Failure: `{ "error": { "code", "message", "details?" } }`.
List endpoints use `paginationSchema` (default 25, max 100) and return `pageMeta`.

## Data model highlights
- **Append-only history:** `LeadAssignment`, `CallLog`, `AuditLog` are never overwritten; reassignments add rows with actor, reason and from/to owner.
- **Soft delete:** `archivedAt` on User, Team, Lead, Campaign, LeadSource.
- **Duplicates:** `Lead.primaryMobile` is indexed but intentionally *not* unique; duplicate handling is a user decision (Phase 05).
- **Idempotency:** `LeadAssignment.idempotencyKey`, `CallLog(providerName, providerCallId)` and `Notification.dedupeKey` are unique to block duplicate jobs/webhooks.
- **Money** is stored in paise (integers).
- **Attendance** is separate from call activity and browser presence.
- **Recordings** store metadata only; audio lives in object storage.

## Seed data
`npm run db:seed` creates permissions, 8 roles with default grants, dispositions, sources, one sample campaign/shift and one dev account per role (`<role>@crm.test`). Development only; refuses to run in production.

## Phases 09–12 status
Follow-ups/automation/notifications, employees/attendance/performance/incentives, QA/reports/audit/AI, and production tooling are implemented; see `docs/PHASES.md` and each feature doc. **None of the code has been built or run.**

## Phase 08 status
Call history, configurable outcomes, provider-neutral telephony with an Exotel adapter (untested against a real account) and a dev sandbox; see `docs/TELEPHONY.md`. All vendor code is under `lib/telephony/`.

## Phase 07 status
Telecaller workspace implemented; see `docs/WORKSPACE.md`. Pure logic: `lib/workspace/queue.ts`, `lib/workspace/status.ts`. Service: `services/workspace-service.ts`.

## Phase 06 status
Distribution engine, rules UI, approvals and unworked alerts; see `docs/DISTRIBUTION.md`. Pure allocation logic is in `lib/distribution/engine.ts`; locking and persistence in `services/distribution-service.ts`.

## Phase 05 status
Lead management implemented; see `docs/LEADS.md` (rules, import pipeline, known gaps).

## Phase 04 status
Admin dashboard with real, scope-aware metrics; see `docs/METRICS.md` for definitions and known limitations.

## Phase 03 status
Auth, sessions and RBAC implemented; see `docs/AUTH.md` (includes open items needing client confirmation).

## Phase 02 status
In progress: tokens, app shell, core UI primitives and two layout previews (see `docs/DESIGN_SYSTEM.md`).

## Phase 01 status
Done: scaffold, schema, seed, core utilities, health endpoint, docs.
Not started (by design): UI shell (02), auth (03), and all CRM modules.
