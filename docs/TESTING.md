# Testing

## What exists
| Kind | Command | Needs | Status |
|---|---|---|---|
| Unit tests (pure logic) | `npm test` | nothing | written, **never run** |
| Integration tests | `TEST_DATABASE_URL=… npm run test:integration` | throwaway PostgreSQL | written, **never run** |
| Type check / lint / build | `npm run verify` | dependencies | **never run** |
| Black-box smoke | `scripts/smoke.sh <url> [CRON_SECRET]` | a running instance | **never run** |
| Static checks (done during development) | n/a | n/a | passed: syntax of every file; every named import resolves to an export (233 files); no server-only code in client bundles; "use server" files export only async functions |

## Unit tests cover
Permissions and data scope; password policy; date ranges (India time); dashboard filters/series; lead import mapping/validation, list filters, CSV safety; distribution engine (5 methods, limits, ordering); workspace queue and status rules; telephony parsing/status/security helpers; call filters and configurable outcomes; automation rule validation; report grouping; QA scorecard; incentive slabs; attendance maths; target periods; role-assignment rules; temporary passwords; live status; rate limiter; log redaction; AI reply parsing.

## Integration tests cover (database required)
Simultaneous distribution runs, double-submitted runs, simultaneous imports (unique lead codes), single-run imports, call save idempotency, other-agent access refusal, callback/DND rules, double-click call start, webhook-before-response, simultaneous identical webhooks, out-of-order webhooks, provider vs agent precedence, inbound matching, failed-event retry.

## Not covered (be aware)
No browser/end-to-end tests (login journeys, forms, keyboard shortcuts, mobile layout); no load/performance tests; no tests for automation execution, follow-up actions, employee/attendance services, QA/report services, incentives, notifications or the AI/Exotel network code against real systems; no accessibility audit beyond following common practices (labels, focus, contrast, 44 px targets, aria).

## Recommended next steps
1. `npm run verify`, fix all errors. 2. Run integration tests. 3. Add Playwright end-to-end tests for: sign-in/out and lockout, forced password change, import → distribute → call → follow-up → convert, each role's menu and forbidden pages, export downloads. 4. Load-test the dashboard, lead list and import with realistic volumes. 5. Manual role-by-role permission walkthrough using a checklist built from `AUTH.md`.

## Build blockers that were pre-empted (because the code could not be compiled here)
- ESLint rule `react/no-unescaped-entities` is switched off (apostrophes in text would otherwise fail `next lint`/`next build`).
- Internal links use `<Link>`; `types/react-canary.d.ts` declares the types for `useFormState`/`useFormStatus`.
- `tsconfig.json` has `noUncheckedIndexedAccess: false` so array-index access can't fail the first build. All other strict checks are on. Turn it back on (`true`) once the build is green and fix what it reports.
