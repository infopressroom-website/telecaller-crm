# Production readiness checklist

Status key: ✅ done in code/docs · ⚠️ done but unverified · ❌ not done / client decision.

## Must be true before real users or real customer data
| # | Item | Status |
|---|---|---|
| 1 | `npm run verify` passes (types, lint, unit tests, build) | ❌ never run |
| 2 | Integration tests pass on a throwaway database | ❌ never run |
| 3 | Migrations generated and committed; `migrate deploy` tested on staging | ❌ |
| 4 | Lockfile committed | ❌ |
| 5 | Docker image builds and runs; `scripts/smoke.sh` passes against staging | ⚠️ written, never run |
| 6 | Production secrets set (`AUTH_SECRET`, `CRON_SECRET`, …), HTTPS and domain, reverse proxy forwards client IP | ❌ deployment task |
| 7 | First administrator and reference data created with `npm run db:bootstrap` (not the dev seed) | ⚠️ written, never run |
| 8 | Scheduler calling `/api/cron/automation` every minute and monitored | ⚠️ endpoint ready |
| 9 | Backups scheduled, copied off-server, **restore rehearsed** | ⚠️ scripts ready, restore untested |
| 10 | Monitoring and alerts (health, 5xx, failed automation, scheduler stale) | ❌ not built in |
| 11 | Role-by-role permission walkthrough and manual end-to-end test of every journey | ❌ |
| 12 | Security review / penetration test; resolve `docs/SECURITY.md` caveats you can't accept | ❌ |
| 13 | Legal review: call recording consent, DND/TRAI rules, privacy notice, retention and erasure, AI/third-party data transfer | ❌ client decision |
| 14 | Telephony: real test call completed, unconfirmed Exotel assumptions resolved | ❌ needs the client's Exotel account |
| 15 | Performance test with realistic volumes (leads list, dashboard, import) | ❌ |
| 16 | User training with ADMIN_GUIDE and TELECALLER_GUIDE; support/escalation contact defined | ❌ |
| 17 | Disaster recovery and rollback plan written and agreed | ❌ |
| 18 | Dependencies audited (`npm audit`), update policy agreed | ❌ |

## Go-live day
Freeze changes · backup · deploy · run migrations · smoke test · create/verify real users and teams · import leads · distribute a small batch · supervised first calls · watch logs/health for the first hours · confirm the scheduler and a notification arrive.

## After go-live (first weeks)
Daily check of the audit log, failed automation logs and webhook health; review the performance numbers against reality (definitions in METRICS.md); collect feedback; plan the roadmap in KNOWN_LIMITATIONS.md.
