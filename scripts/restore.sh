#!/usr/bin/env bash
# Restore a backup INTO AN EMPTY DATABASE. Usage: DATABASE_URL=postgresql://... scripts/restore.sh backups/crm-XXXX.dump
# Never point this at the live production database without a plan: it is for disaster recovery and restore drills.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
FILE="${1:?Give the backup file}"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="${DATABASE_URL%%\?*}" "$FILE"
echo "Restore finished. Run scripts/smoke.sh and check row counts before switching traffic."
