# Deployment guide

> Nothing here has been run yet. Do a full rehearsal on a staging copy first and treat this as a checklist, not a guarantee.

## What you need
- A server or platform that runs Node 20 (or Docker), PostgreSQL 14+, HTTPS with a real domain, and a scheduler (cron) that can call a URL every minute.
- Secrets in the platform's secret store, never in git.

## 1. Create migrations (once, on a development database)
The repository has no migration files yet.
```bash
npm run db:push            # (or) create a dev DB and:
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "Add initial migration"
```
Production applies them with `npx prisma migrate deploy`. Never use `db:push` or `migrate dev` on production data.

## 2. Configure the environment
See `ENVIRONMENT.md`. Minimum for production: `DATABASE_URL`, `NODE_ENV=production`, `APP_URL` (public https), `AUTH_SECRET` (32+ random characters), `CRON_SECRET` (24+). Add telephony/AI variables only if you use them.
Generate secrets with `openssl rand -base64 32` (AUTH_SECRET) and `openssl rand -hex 24` (CRON_SECRET, EXOTEL_WEBHOOK_SECRET).

## 3. Option A: Docker Compose (single server)
```bash
cp .env.example .env       # edit; add POSTGRES_PASSWORD
docker compose up --build -d
```
`migrate` runs `prisma migrate deploy` once, then `app` starts on port 3000 (health check: `/api/health`). Put a reverse proxy with HTTPS (Caddy, nginx, a cloud load balancer) in front; terminate TLS there and forward `X-Forwarded-For`.

## 3. Option B: your own Node host
```bash
npm ci && npx prisma generate && npm run build
npx prisma migrate deploy
node .next/standalone/server.js     # copy .next/static and public next to it (see Dockerfile)
```
Run under a process manager (systemd, pm2).

## 4. First administrator and reference data
**Do not run `db:seed` in production** (it creates development accounts and refuses when `NODE_ENV=production`). Use the bootstrap command instead; it is safe to run in production and to re-run:
```bash
BOOTSTRAP_ADMIN_EMAIL=owner@yourcompany.com BOOTSTRAP_ADMIN_NAME="Owner Name" npm run db:bootstrap
# with Docker Compose:
docker compose run --rm -e BOOTSTRAP_ADMIN_EMAIL=owner@yourcompany.com migrate npx tsx prisma/bootstrap.ts
```
It creates permissions, roles (with their default grants), the built-in call outcomes and the starter automation rules (OFF), and, **only if no active Super Admin exists**, the first Super Admin with a generated temporary password that is printed once. The admin must change it at first sign-in. Run it somewhere private and clear the terminal afterwards. Role grants live in `lib/permissions.ts` and are re-applied on every run. It creates no demo data.
Then sign in and create real teams, employees, shifts, sources and campaigns from the app.

## 5. Scheduler
Every minute: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/automation`. Check **Automation → Scheduler** shows a recent run.

## 6. Telephony (optional)
Follow the go-live checklist in `TELEPHONY.md`.

## 7. Backups
`DATABASE_URL=… scripts/backup.sh /secure/path` (custom-format `pg_dump`, keeps 14 days). Schedule it daily and **copy the files off the server**. Also enable your cloud database's own point-in-time recovery if available. **Rehearse a restore** with `scripts/restore.sh` into an empty database and run `scripts/smoke.sh`, at least before go-live and then quarterly. A backup that has never been restored is not a backup.

## 8. Verify a deployment
```bash
scripts/smoke.sh https://your-domain "$CRON_SECRET"
```
Checks health, login page, sign-in redirect, anonymous API refusal, hidden webhook/cron endpoints, security headers and the scheduler.

## 9. Updating
1. Take a backup. 2. Deploy the new build to staging; run `npm run verify` and the smoke script. 3. `npx prisma migrate deploy`. 4. Roll out; watch `/api/health` and the logs. 5. Keep the previous image/build for rollback (database migrations are forward-only; plan data-safe migrations).

## Monitoring (not built in)
Structured JSON logs go to stdout (`LOG_LEVEL`). There is no built-in error tracker, metrics or alerting: connect one (Sentry, Datadog, Grafana/Prometheus) and alert on `/api/health` failures, 5xx rates, failed automation logs, and the "scheduler not running" condition.
