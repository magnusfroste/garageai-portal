#!/usr/bin/env bash
# Starts the portal as one app (see Dockerfile). Needs:
#   DATABASE_URL        the app's Postgres, created with the roles anon, authenticated and
#                       service_role (Shipholm: db_roles="supabase")
#   PORTAL_JWT_SECRET   signs sessions and the anon/service keys; at least 32 characters, secret
#   PORTAL_PUBLIC_URL   the address browsers use, e.g. https://app.garageai.eu (no trailing slash)
# Optional: any GOTRUE_* or PGRST_* variable overrides the defaults below (SMTP, Google sign-in,
# GOTRUE_MAILER_AUTOCONFIRM=true for a rehearsal without mail); PORTAL_CRON=off stops the
# scheduled jobs; PORTAL_IMPORT_URL + PORTAL_IMPORT_TOKEN fill an empty database once
# (import.sh); the functions' own secrets (LITELLM_MASTER_KEY, STRIPE_SECRET_KEY, …) are
# passed on to them as they are.
# Writes only under /tmp. If any part stops, the container stops, and the platform restarts it.
# The port answers only when sign-in and the data API are up (Caddy starts last): until then a
# health check fails, so a version that cannot start never takes over from the one that runs.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is not set}"
: "${PORTAL_JWT_SECRET:?PORTAL_JWT_SECRET is not set}"
: "${PORTAL_PUBLIC_URL:?PORTAL_PUBLIC_URL is not set}"
[[ ${#PORTAL_JWT_SECRET} -ge 32 ]] || { echo "PORTAL_JWT_SECRET must be at least 32 characters" >&2; exit 1; }
PORTAL_PUBLIC_URL=${PORTAL_PUBLIC_URL%/}
export PORT=${PORT:-8080} HOME=/tmp XDG_CONFIG_HOME=/tmp/xdg XDG_DATA_HOME=/tmp/xdg
log() { echo "portal: $*"; }

# --- keys: the same every start, so a page loaded before a restart keeps working -------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt_for() {   # a key for a role, valid ten years from a fixed date (rotate by changing the secret)
  local head body
  head=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  body=$(printf '{"role":"%s","iss":"garageai-portal","iat":1795737600,"exp":2111270400}' "$1" | b64url)
  printf '%s.%s.%s' "$head" "$body" \
    "$(printf '%s.%s' "$head" "$body" | openssl dgst -sha256 -hmac "$PORTAL_JWT_SECRET" -binary | b64url)"
}
ANON_KEY=$(jwt_for anon)
SERVICE_ROLE_KEY=$(jwt_for service_role)

# --- frontend: a copy of the build with this deployment's address and public key -------------
export WWW_DIR=/tmp/www
rm -rf "$WWW_DIR"; cp -r /app/www "$WWW_DIR"
grep -rlE 'portal-public-url\.invalid|PORTAL_ANON_KEY_PLACEHOLDER' "$WWW_DIR" | while read -r f; do
  sed -i -e "s|https://portal-public-url\.invalid|$PORTAL_PUBLIC_URL|g" \
         -e "s|PORTAL_ANON_KEY_PLACEHOLDER|$ANON_KEY|g" "$f"
done

pids=()
start() { log "starting $1"; shift; "$@" & pids+=($!); }
stop_all() { kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null || true; }
trap 'stop_all; exit 143' TERM INT

# --- database ---------------------------------------------------------------------------------
sql() { psql "$DATABASE_URL" -q -tA -v ON_ERROR_STOP=1 "$@"; }
for _ in $(seq 60); do sql -c 'select 1' >/dev/null 2>&1 && break; sleep 2; done
roles=$(sql -c "select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')")
[[ "$roles" == 3 ]] || { echo "the database lacks the roles anon, authenticated and service_role (create it with db_roles=\"supabase\")" >&2; stop_all; exit 1; }
sql -c 'CREATE SCHEMA IF NOT EXISTS auth' -c 'CREATE SCHEMA IF NOT EXISTS extensions'
# Our own bookkeeping, outside the portal's schema: which scheduled runs are taken, and
# whether the data import has run.
sql <<'SQL'
SET client_min_messages = warning;
CREATE SCHEMA IF NOT EXISTS portal_ops;
CREATE TABLE IF NOT EXISTS portal_ops.cron_runs (
  job text NOT NULL, slot timestamptz NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job, slot));
CREATE TABLE IF NOT EXISTS portal_ops.imports (
  source text NOT NULL, tables integer NOT NULL, rows bigint NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now());
SQL

# --- GoTrue: creates and migrates its own tables in schema auth ---------------------------------
sep='?'; [[ "$DATABASE_URL" == *\?* ]] && sep='&'
export GOTRUE_DB_DRIVER=postgres GOTRUE_DB_NAMESPACE=auth \
  GOTRUE_DB_DATABASE_URL="${DATABASE_URL}${sep}search_path=auth" \
  GOTRUE_API_HOST=127.0.0.1 \
  API_EXTERNAL_URL="${API_EXTERNAL_URL:-$PORTAL_PUBLIC_URL/auth/v1}" \
  GOTRUE_SITE_URL="${GOTRUE_SITE_URL:-$PORTAL_PUBLIC_URL}" \
  GOTRUE_URI_ALLOW_LIST="${GOTRUE_URI_ALLOW_LIST:-$PORTAL_PUBLIC_URL/**}" \
  GOTRUE_JWT_SECRET="$PORTAL_JWT_SECRET" \
  GOTRUE_JWT_EXP="${GOTRUE_JWT_EXP:-3600}" \
  GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_EXTERNAL_EMAIL_ENABLED="${GOTRUE_EXTERNAL_EMAIL_ENABLED:-true}" \
  GOTRUE_MAILER_AUTOCONFIRM="${GOTRUE_MAILER_AUTOCONFIRM:-false}" \
  GOTRUE_DISABLE_SIGNUP="${GOTRUE_DISABLE_SIGNUP:-false}"
# Google sign-in: on when the operator sets GOTRUE_EXTERNAL_GOOGLE_ENABLED=true with
# GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID and GOTRUE_EXTERNAL_GOOGLE_SECRET (GarageAI's own OAuth client,
# whose authorised redirect URI must be exactly the address below).
export GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI="${GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI:-$PORTAL_PUBLIC_URL/auth/v1/callback}"
if [[ "${GOTRUE_EXTERNAL_GOOGLE_ENABLED:-false}" == true ]]; then
  [[ -n "${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:-}" && -n "${GOTRUE_EXTERNAL_GOOGLE_SECRET:-}" ]] \
    || { echo "GOTRUE_EXTERNAL_GOOGLE_ENABLED=true needs GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID and GOTRUE_EXTERNAL_GOOGLE_SECRET" >&2; stop_all; exit 1; }
  log "Google sign-in is on; redirect URI $GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI"
fi
PORT=9999 start gotrue auth
for _ in $(seq 90); do
  [[ "$(sql -c "select to_regclass('auth.users') is not null" 2>/dev/null)" == t ]] \
    && curl -fs -o /dev/null http://127.0.0.1:9999/health && break
  kill -0 "${pids[-1]}" 2>/dev/null || { echo "GoTrue stopped while starting" >&2; stop_all; exit 1; }
  sleep 1
done
curl -fs -o /dev/null http://127.0.0.1:9999/health || { echo "GoTrue did not become ready" >&2; stop_all; exit 1; }

# --- the portal's own schema, only into an empty database --------------------------------------
if [[ "$(sql -c "select count(*) from pg_tables where schemaname = 'public'")" == 0 ]]; then
  log "empty database: creating the schema from db/schema.sql and db/grants.sql"
  cat /app/generated/schema.sql /app/generated/grants.sql | psql "$DATABASE_URL" -q -1 -v ON_ERROR_STOP=1 >/dev/null
fi

# --- data: once, into the empty schema ---------------------------------------------------------
if [[ -n "${PORTAL_IMPORT_URL:-}" ]]; then
  /app/import.sh || { echo "the data import failed; nothing was changed" >&2; stop_all; exit 1; }
fi

# --- PostgREST ---------------------------------------------------------------------------------
export PGRST_DB_URI="$DATABASE_URL" PGRST_DB_SCHEMAS="${PGRST_DB_SCHEMAS:-public}" \
  PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$PORTAL_JWT_SECRET" \
  PGRST_DB_EXTRA_SEARCH_PATH="${PGRST_DB_EXTRA_SEARCH_PATH:-public,extensions}" \
  PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=3000 \
  PGRST_DB_POOL="${PGRST_DB_POOL:-10}" PGRST_DB_MAX_ROWS="${PGRST_DB_MAX_ROWS:-1000}"
start postgrest postgrest
for _ in $(seq 60); do curl -fs -o /dev/null http://127.0.0.1:3000/ && break; sleep 1; done
curl -fs -o /dev/null http://127.0.0.1:3000/ || { echo "PostgREST did not become ready" >&2; stop_all; exit 1; }

# --- edge functions ----------------------------------------------------------------------------
export SUPABASE_URL="http://127.0.0.1:$PORT" SUPABASE_ANON_KEY="$ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
start functions edge-runtime start --main-service /app/functions/main --ip 127.0.0.1 -p 9000

# --- scheduled jobs ----------------------------------------------------------------------------
if [[ "${PORTAL_CRON:-on}" != off ]]; then
  start cron supercronic -quiet /app/crontab
else
  log "scheduled jobs are off (PORTAL_CRON=off)"
fi

# --- the address itself, last ------------------------------------------------------------------
start caddy caddy run --config /app/Caddyfile --adapter caddyfile

log "up on :$PORT for $PORTAL_PUBLIC_URL"
wait -n "${pids[@]}" || true
echo "portal: a part stopped; stopping the rest" >&2
stop_all
exit 1
