# HTTP API reference

Most interaction uses Next.js server actions (forms) rather than REST. These are the real HTTP endpoints. Success: `{ "data": … }`; failure: `{ "error": { "code", "message" } }`.

| Method | Path | Authentication |
|---|---|---|
| GET | `/api/auth/me` | Signed-in session (returns the caller's own role and permissions) |
| GET | `/api/calls/{id}/recording` | Session + permission (`call:VIEW`) |
| GET, POST | `/api/cron/automation` | Bearer CRON_SECRET |
| GET | `/api/health` | Public (no sensitive data) |
| GET | `/api/leads/export` | Session + permission (`lead:EXPORT`) |
| GET | `/api/leads/import/{id}/report` | Session + permission (`lead:CREATE`) |
| GET | `/api/leads/import/{id}` | Session + permission (`lead:CREATE`) |
| POST | `/api/leads/import` | Session + permission (`lead:CREATE`) |
| GET | `/api/reports/{type}/export` | Session + permission (`report:EXPORT`) |
| POST | `/api/webhooks/telephony/{provider}/{secret}` | Secret in URL (+ optional IP/signature) |

All other endpoints are server actions in `app/actions/*.ts`, called by the app's own forms; they re-check the signed-in user and their permissions on the server.
