# Known limitations (consolidated)

**Biggest one: the code has never been built or run.** Expect compile/type errors on first `npm run verify`, and bugs in the paths no test touches. See `TESTING.md`.

## Platform
- No committed database migrations (generate them once; see DEPLOYMENT.md). The production bootstrap command (`npm run db:bootstrap`) exists but has never been run.
- No lockfile (`package-lock.json`); run `npm install` and commit it.
- Rate limiting is per process. No Redis, no background worker/queue: imports run inside the request (≤ 20,000 rows), automation relies on an external scheduler.
- No built-in monitoring/alerting/error tracking; logs are JSON on stdout.
- No MFA/SSO; no user-facing session management.
- Time zone is fixed to India (UTC+5:30) in dashboards, follow-ups, shifts and reports.
- UI is English only; no i18n; no dark mode; no offline use. Accessibility not audited.

## Product gaps by phase
- **Leads:** fixed status list (not configurable); custom fields exist in the data model without UI; bulk actions limited to the current page (200); merge can't be undone from the UI; search uses `ILIKE` (add trigram indexes for very large data).
- **Distribution:** no automatic trigger without the scheduler; only telecallers get automatic assignment; no weighted/shift-aware distribution.
- **Workspace:** call duration is an on-screen timer unless telephony is live; keyboard shortcuts fixed.
- **Telephony:** Exotel adapter untested against a real account; webhook signature scheme, timestamp zone and IP ranges unconfirmed; recordings are links only; no call costs; inbound calls attributed to the lead's owner only.
- **Notifications:** in-app only; no email/SMS/WhatsApp; no customer messaging, therefore no opt-out handling.
- **Automation:** fixed trigger/action catalogue; no custom message text.
- **Attendance/incentives:** no leave workflow or balances, no payroll/tax/payout, no auto-absent marking.
- **QA/Reports/AI:** scorecard fixed in code; PDF is a plain Latin-1 table; no scheduled/emailed reports; AI needs pasted transcripts, is optional, untested, and has no speech-to-text.
- **Compliance:** no data-retention/erasure tooling; DND/TRAI checks, call-recording consent and privacy notices are not implemented and need legal advice.

## Suggested roadmap
1. Make it build, test, deploy to staging (Phase 12 checklist). 2. Add e2e tests. 3. Production bootstrap command + migrations + lockfile. 4. Redis (rate limits, queue) and a background worker. 5. Notification channels with consent. 6. Compliance features (consent, DND scrubbing, retention). 7. Configurable statuses/fields/scorecards. 8. Monitoring and alerting.
