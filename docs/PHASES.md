# Phase index

| Phase | What it delivers | Detailed docs |
|---|---|---|
| 01 Foundation | Prisma schema, seed, env validation, error/pagination utilities, health check | ARCHITECTURE.md, DATABASE.md |
| 02 UI/UX | Design tokens, app shell (collapsible sidebar, mobile drawer), UI primitives | DESIGN_SYSTEM.md |
| 03 Auth & RBAC | Database sessions, lockout, password reset/change, 8 roles × 16 resources × 8 actions, data scope | AUTH.md |
| 04 Dashboard | 10 KPIs, 7 charts, filters, recent activity, metric definitions | METRICS.md |
| 05 Leads | Search/filters/saved views, bulk actions, CSV/Excel import with duplicate handling, export, merge, timeline | LEADS.md |
| 06 Distribution | 5 methods, rules, limits, preview/apply with locking, approvals, unworked alerts | DISTRIBUTION.md |
| 07 Workspace | Home, next-lead queue, single-screen call flow, drafts, shortcuts | WORKSPACE.md |
| 08 Calls & telephony | Call history, configurable outcomes, provider adapter (Exotel, untested), sandbox, webhooks | TELEPHONY.md |
| 09 Follow-ups & automation | Follow-up views/actions, trigger→condition→action rules, scheduler endpoint, in-app notifications | AUTOMATION.md |
| 10 Team & performance | Employees, teams, attendance/breaks/shifts/leave, live status, performance, targets, incentives | TEAM_PERFORMANCE.md |
| 11 QA, reports, AI | Scorecards, 10 reports with CSV/Excel/PDF, audit viewer, optional AI summaries | QA_REPORTS_AI.md |
| 12 Production | Docker, CI, backups, rate limiting, CSP, logging, smoke tests, handover docs | DEPLOYMENT.md, SECURITY.md, PRODUCTION_CHECKLIST.md |

Every feature doc ends with a "Known gaps" section. `KNOWN_LIMITATIONS.md` consolidates them.
