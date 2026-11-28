#!/usr/bin/env bash
# One-shot import of the portal's data into this app's database (docs/leaving-lovable.md,
# "How production data moves"). Run by entrypoint.sh when PORTAL_IMPORT_URL is set.
#
#   PORTAL_IMPORT_URL    https://…/<dir> holding manifest.json and one <schema>.<table>.jsonl per table
#   PORTAL_IMPORT_TOKEN  sent as "Authorization: Bearer …"
#
# manifest.json: {"source": "...", "exported_at": "...",
#                 "tables": [{"table": "auth.users", "rows": 27, "file": "auth.users.jsonl"}, ...]}
# A .jsonl file has one row per line, as `select row_to_json(t) from <table> t` gives it.
#
# Everything happens in ONE transaction, as the database owner: any error (a table that already
# has rows, a row count that differs from the manifest, a broken download, a foreign key that
# does not hold) leaves the database exactly as it was. Rows go in as they are: user triggers
# are off while loading (handle_new_user would create every profile twice), foreign keys of the
# loaded tables are dropped first and put back at the end, where Postgres checks them all, so
# the order of tables and keys that point in circles do not matter. Sequences are moved past
# the highest id. Rows are streamed table by table; nothing is kept in /tmp but the token.
# After it has run once it never runs again (portal_ops.imports): remove both variables then.
set -euo pipefail
: "${PORTAL_IMPORT_URL:?}" "${PORTAL_IMPORT_TOKEN:?}" "${DATABASE_URL:?}"
url=${PORTAL_IMPORT_URL%/}
sql() { psql "$DATABASE_URL" -q -tA -v ON_ERROR_STOP=1 "$@"; }

if [[ "$(sql -c 'select count(*) from portal_ops.imports')" != 0 ]]; then
  echo "import: already done ($(sql -c "select source || ', ' || finished_at from portal_ops.imports limit 1")): remove PORTAL_IMPORT_URL and PORTAL_IMPORT_TOKEN"
  exit 0
fi

headers=$(mktemp /tmp/import-headers.XXXXXX); trap 'rm -f "$headers"' EXIT
printf 'Authorization: Bearer %s\n' "$PORTAL_IMPORT_TOKEN" > "$headers"
fetch() { curl -fsS --retry 3 --retry-delay 2 -m 900 -H @"$headers" "$url/$1"; }

manifest=$(fetch manifest.json)
source=$(jq -er '.source' <<<"$manifest")
mapfile -t tables < <(jq -er '.tables[] | "\(.table) \(.rows) \(.file)"' <<<"$manifest")
[[ ${#tables[@]} -gt 0 ]] || { echo "import: the manifest lists no tables" >&2; exit 1; }
names=()
for entry in "${tables[@]}"; do
  read -r table rows file <<<"$entry"
  [[ "$table" =~ ^(public|auth)\.[a-z_][a-z0-9_]*$ && "$rows" =~ ^[0-9]+$ && "$file" =~ ^[a-z0-9_.-]+\.jsonl$ ]] \
    || { echo "import: the manifest has an entry this import does not accept: $entry" >&2; exit 1; }
  names+=("'$table'")
done
list=$(IFS=,; echo "${names[*]}")
echo "import: ${#tables[@]} tables from $source"

{
  cat <<SQL
SET client_min_messages = warning;
CREATE TEMP TABLE _fk ON COMMIT DROP AS
  SELECT c.conrelid::regclass::text AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid = ANY (ARRAY[$list]::regclass[]);
SELECT format('ALTER TABLE %s DROP CONSTRAINT %I', tbl, conname) FROM _fk \gexec
CREATE TEMP TABLE _in (line json) ON COMMIT DROP;
SQL
  total=0
  for entry in "${tables[@]}"; do
    read -r table rows file <<<"$entry"
    total=$((total + rows))
    cat <<SQL
DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM $table) THEN
  RAISE EXCEPTION 'import: % already has rows; this import only fills an empty database', '$table'; END IF; END \$\$;
ALTER TABLE $table DISABLE TRIGGER USER;
TRUNCATE _in;
SQL
    # psql runs the download itself and feeds it to COPY: no end-of-data marker in the stream
    # (a "\\." line is data to a Postgres 18 server in CSV mode when the client is older), and
    # a failed download fails the statement.
    if [[ "$rows" != 0 ]]; then
      printf '%s\n' "\\copy _in from program 'curl -fsS --retry 3 --retry-delay 2 -m 900 -H @$headers $url/$file' with (format csv, quote E'\\x01', delimiter E'\\x02')"
    fi
    cat <<SQL
DO \$\$ DECLARE n bigint; BEGIN SELECT count(*) INTO n FROM _in; IF n <> $rows THEN
  RAISE EXCEPTION 'import: %: the manifest says % rows, the file has %', '$table', $rows, n; END IF; END \$\$;
SELECT format('INSERT INTO $table (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM _in, json_populate_record(null::$table, _in.line) r',
              string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
              string_agg('r.' || quote_ident(a.attname), ', ' ORDER BY a.attnum))
  FROM pg_attribute a
  WHERE a.attrelid = '$table'::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
    AND a.attname IN (SELECT k FROM (SELECT line FROM _in LIMIT 1) first, json_object_keys(first.line) k)
  HAVING count(*) > 0 \gexec
ALTER TABLE $table ENABLE TRIGGER USER;
SQL
  done
  cat <<SQL
SELECT format('ALTER TABLE %s ADD CONSTRAINT %I %s', tbl, conname, def) FROM _fk \gexec
SELECT format('SELECT setval(%L, (SELECT coalesce(max(%I), 0) + 1 FROM %s), false)',
              pg_get_serial_sequence(c.oid::regclass::text, a.attname), a.attname, c.oid::regclass)
  FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE c.oid = ANY (ARRAY[$list]::regclass[]) AND a.attnum > 0 AND NOT a.attisdropped
    AND pg_get_serial_sequence(c.oid::regclass::text, a.attname) IS NOT NULL \gexec
INSERT INTO portal_ops.imports (source, tables, rows) VALUES ($(printf '%s' "$source" | jq -Rr '@sh'), ${#tables[@]}, $total);
SQL
} | psql "$DATABASE_URL" -q -1 -v ON_ERROR_STOP=1 >/dev/null

echo "import: done, $(sql -c 'select rows from portal_ops.imports') rows in ${#tables[@]} tables; remove PORTAL_IMPORT_URL and PORTAL_IMPORT_TOKEN now"
