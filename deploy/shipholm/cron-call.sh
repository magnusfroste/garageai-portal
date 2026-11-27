#!/usr/bin/env bash
# One scheduled job (see crontab). Secrets never appear on a command line: curl reads its
# headers from a file in /tmp that only this user can read.
#   cron-call.sh fn <function>        POST with x-cron-secret (internal_secrets.sync_models_cron_secret)
#   cron-call.sh event-mail           POST with the Bearer token the function checks (LOVABLE_CRON_SECRET)
#   cron-call.sh sql <name> "<statement>"
# During a deploy two pods run for a moment and both fire the same job. Each first claims the
# job's minute in portal_ops.cron_runs; only the one whose row goes in runs it.
set -euo pipefail
base="http://127.0.0.1:${PORT}/functions/v1"
headers=$(mktemp /tmp/cron-headers.XXXXXX); trap 'rm -f "$headers"' EXIT
sql() { psql "$DATABASE_URL" -q -tA -v ON_ERROR_STOP=1 "$@"; }

kind=${1:-}; job=${2:-$kind}
[[ "$job" =~ ^[a-z0-9-]+$ ]] || { echo "usage: cron-call.sh fn <function> | event-mail | sql <name> <statement>" >&2; exit 2; }
claimed=$(sql -c "delete from portal_ops.cron_runs where slot < now() - interval '7 days'" \
              -c "insert into portal_ops.cron_runs (job, slot) values ('$job', date_trunc('minute', now()))
                  on conflict do nothing returning 1")
[[ "$claimed" == 1 ]] || { echo "cron $job: another pod has this run"; exit 0; }

case "$kind" in
  sql)
    sql -c "$3" >/dev/null
    echo "cron $job: ok" ;;
  fn)
    secret=$(sql -c "select value from public.internal_secrets where name = 'sync_models_cron_secret'")
    [[ -n "$secret" ]] || { echo "cron $job: internal_secrets.sync_models_cron_secret is not set" >&2; exit 1; }
    printf 'x-cron-secret: %s\n' "$secret" > "$headers"
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 300 -X POST -H 'Content-Type: application/json' \
      -H @"$headers" -d '{}' "$base/$job")
    echo "cron $job: HTTP $code"; [[ "$code" == 2* ]] ;;
  event-mail)
    [[ -n "${LOVABLE_CRON_SECRET:-}" ]] || { echo "cron event-mail: LOVABLE_CRON_SECRET is not set" >&2; exit 1; }
    printf 'Authorization: Bearer %s\n' "$LOVABLE_CRON_SECRET" > "$headers"
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 120 -X POST -H 'Content-Type: application/json' \
      -H @"$headers" -d '{"action":"run"}' "$base/event-mail")
    echo "cron event-mail: HTTP $code"; [[ "$code" == 2* ]] ;;
  *) echo "usage: cron-call.sh fn <function> | event-mail | sql <name> <statement>" >&2; exit 2 ;;
esac
