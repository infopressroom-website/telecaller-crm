#!/usr/bin/env bash
# Quick black-box checks against a running instance. Usage: scripts/smoke.sh https://your-domain  [CRON_SECRET]
set -u
BASE="${1:?Give the base URL, e.g. http://localhost:3000}"; CRON="${2:-}"
pass=0; fail=0
check() { # name expected-status actual-status
  if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (expected $2, got $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }
check "health endpoint"                 200 "$(code "$BASE/api/health")"
check "login page loads"                200 "$(code "$BASE/login")"
check "dashboard redirects when signed out" 307 "$(code "$BASE/dashboard")"
check "API refuses anonymous user"      401 "$(code "$BASE/api/auth/me")"
check "webhook with wrong secret is hidden" 404 "$(code -X POST "$BASE/api/webhooks/telephony/exotel/not-the-secret" -d '{}')"
check "cron without token is hidden"    404 "$(code -X POST "$BASE/api/cron/automation")"
hdr="$(curl -sI --max-time 20 "$BASE/login")"
echo "$hdr" | grep -qi '^x-frame-options: DENY' && { echo "PASS  security headers present"; pass=$((pass+1)); } || { echo "FAIL  security headers missing"; fail=$((fail+1)); }
[ -n "$CRON" ] && check "cron with token works" 200 "$(code -X POST -H "Authorization: Bearer $CRON" "$BASE/api/cron/automation")"
echo; echo "$pass passed, $fail failed"; [ "$fail" -eq 0 ]
