#!/usr/bin/env bash
# One scheduled job (see crontab). Secrets never appear on a command line: curl reads its
# headers from a file in /tmp that only this user can read.
#   cron-call.sh fn <function>   POST with x-cron-secret (internal_secrets.sync_models_cron_secret)
#   cron-call.sh event-mail      POST with the Bearer token the function checks (LOVABLE_CRON_SECRET)
#   cron-call.sh sql "<statement>"
set -euo pipefail
base="http://127.0.0.1:${PORT}/functions/v1"
headers=$(mktemp /tmp/cron-headers.XXXXXX); trap 'rm -f "$headers"' EXIT

case "${1:-}" in
  sql)
    psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "$2" >/dev/null
    echo "cron sql ok: ${2:0:60}" ;;
  fn)
    secret=$(psql "$DATABASE_URL" -tA -v ON_ERROR_STOP=1 \
      -c "select value from public.internal_secrets where name = 'sync_models_cron_secret'")
    [[ -n "$secret" ]] || { echo "cron $2: internal_secrets.sync_models_cron_secret is not set" >&2; exit 1; }
    printf 'x-cron-secret: %s\n' "$secret" > "$headers"
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 300 -X POST -H 'Content-Type: application/json' \
      -H @"$headers" -d '{}' "$base/$2")
    echo "cron $2: HTTP $code"; [[ "$code" == 2* ]] ;;
  event-mail)
    [[ -n "${LOVABLE_CRON_SECRET:-}" ]] || { echo "cron event-mail: LOVABLE_CRON_SECRET is not set" >&2; exit 1; }
    printf 'Authorization: Bearer %s\n' "$LOVABLE_CRON_SECRET" > "$headers"
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 120 -X POST -H 'Content-Type: application/json' \
      -H @"$headers" -d '{"action":"run"}' "$base/event-mail")
    echo "cron event-mail: HTTP $code"; [[ "$code" == 2* ]] ;;
  *) echo "usage: cron-call.sh fn <function> | event-mail | sql <statement>" >&2; exit 2 ;;
esac
