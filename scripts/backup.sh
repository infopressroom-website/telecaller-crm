#!/usr/bin/env bash
# Logical backup of the CRM database. Usage: DATABASE_URL=postgresql://... scripts/backup.sh [output-dir]
# Schedule it (cron) and COPY THE FILES OFF THE SERVER. Test restores regularly with scripts/restore.sh.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
OUT="${1:-./backups}"; mkdir -p "$OUT"
FILE="$OUT/crm-$(date -u +%Y%m%dT%H%M%SZ).dump"
# Strip Prisma's ?schema= parameter, which pg_dump doesn't understand.
pg_dump --format=custom --no-owner --no-privileges --dbname="${DATABASE_URL%%\?*}" --file="$FILE"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
# Keep 14 days locally; adjust to your retention policy.
find "$OUT" -name 'crm-*.dump' -mtime +14 -delete
