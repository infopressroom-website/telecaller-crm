# Telecaller CRM

A smart telecalling and workforce-management platform: lead management, automatic distribution, a telecaller workspace, call tracking, follow-ups and automation, attendance, performance and incentives, QA, reports, and an optional AI assistant.
Stack: Next.js 14 (App Router) · React · TypeScript · Tailwind · PostgreSQL + Prisma · Zod · Recharts.

> **READ THIS FIRST: honest status.** All 12 phases are written, but this code **has never been installed, built or run** (it was produced in an environment with no network). Static checks (syntax, import/export consistency, server/client boundaries) pass; the type-checker, linter, unit tests, integration tests, build and every real-world integration (telephony, AI) are **unverified**. Expect to fix some compile errors on the first build. Follow "First run" below, and see `docs/PRODUCTION_CHECKLIST.md` before any real use.

## What is in it (12 phases)
| # | Phase | Main pages |
|---|---|---|
| 1 | Foundation: schema (42 tables), seed, utilities | `/api/health` |
| 2 | Design system and app shell | every page |
| 3 | Login, sessions, 8 roles, server-side permissions | `/login`, `/change-password` |
| 4 | Admin dashboard | `/dashboard` |
| 5 | Lead management, import/export, merge, timeline | `/leads`, `/leads/import` |
| 6 | Smart distribution, rules, approvals | `/distribution` |
| 7 | Telecaller workspace and call flow | `/workspace` |
| 8 | Call history, telephony adapter (Exotel), outcomes | `/calls`, `/settings/telephony` |
| 9 | Follow-ups, automation engine, notifications | `/follow-ups`, `/automation`, `/notifications` |
| 10 | Employees, attendance, performance, targets, incentives | `/team`, `/attendance`, `/performance` |
| 11 | QA, reports (CSV/Excel/PDF), audit log, AI assistant | `/qa`, `/reports`, `/audit` |
| 12 | Docker, CI, backups, security hardening, handover docs | `Dockerfile`, `scripts/`, `docs/` |

Each phase has its own documentation; see `docs/PHASES.md` for the index.

## First run (development)
Requires Node 20+ and PostgreSQL 14+.
```bash
cp .env.example .env              # set DATABASE_URL, AUTH_SECRET (32+ chars), SEED_DEV_PASSWORD
npm install                       # also runs `prisma generate`
npm run db:push                   # create tables in a throwaway dev database
npm run db:seed                   # roles, permissions, outcomes, dev accounts, starter automation rules (off)
npm run db:seed:demo              # optional: ~300 fabricated leads, calls, follow-ups, targets
npm run verify                    # prisma generate + tsc + lint + unit tests + build
npm run dev                       # http://localhost:3000
```
Sign in with `<role>@crm.test` (e.g. `admin@crm.test`, `manager@crm.test`, `telecaller@crm.test`) and the password from `SEED_DEV_PASSWORD`. These accounts exist only for development: **never run the seed in production** (it refuses to).

Optional deeper checks (throwaway database only): `TEST_DATABASE_URL=… npm run test:integration`. Black-box checks of a running instance: `scripts/smoke.sh http://localhost:3000`.

If `npm run verify` reports errors, fix them in the order tsc → lint → tests → build, and send them to whoever maintains the code; most will be small type mismatches.

## Production
Create the first administrator with `npm run db:bootstrap` (never the dev seed). See `docs/DEPLOYMENT.md` (Docker/compose, migrations, scheduler, backups) and `docs/PRODUCTION_CHECKLIST.md` (what is verified, what is not, and what must be done before go-live).

## Documentation
`docs/PHASES.md` · `ARCHITECTURE.md` · `ADMIN_GUIDE.md` · `TELECALLER_GUIDE.md` · `ENVIRONMENT.md` · `SECURITY.md` · `TESTING.md` · `KNOWN_LIMITATIONS.md` · `DATABASE.md` · `API.md` · plus per-feature docs (`AUTH`, `METRICS`, `LEADS`, `DISTRIBUTION`, `WORKSPACE`, `TELEPHONY`, `AUTOMATION`, `TEAM_PERFORMANCE`, `QA_REPORTS_AI`, `DESIGN_SYSTEM`).
