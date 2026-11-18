# Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NODE_ENV` | yes in prod | `production` enables secure cookies, HSTS, blocks dev seed and sandbox telephony |
| `APP_URL` | yes in prod | Public base URL (https). Used in reset links and the telephony webhook URL |
| `AUTH_SECRET` | yes | 32+ random characters (validated at startup) |
| `CRON_SECRET` | for scheduler | 24+ characters; Bearer token for `/api/cron/automation` |
| `SEED_DEV_PASSWORD` | dev only | Password for seeded dev accounts |
| `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN` | for live calling | Telephony credentials (server only) |
| `EXOTEL_WEBHOOK_SECRET` | for live calling | 24+ characters; secret in the webhook URL path |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | for AI assistant | Optional; both needed, then enable in Settings → AI |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn`, `error` |
| `APP_VERSION` | no | Shown by `/api/health` |
| `POSTGRES_PASSWORD` | docker compose | Database password for the bundled Postgres |
| `TEST_DATABASE_URL` | tests only | Throwaway database for integration tests |
| `REDIS_URL`, `TELEPHONY_PROVIDER`, `STORAGE_BUCKET` | unused | Reserved in `.env.example`; not used by this code |

Secrets are read only on the server. Never prefix them with `NEXT_PUBLIC_`.
