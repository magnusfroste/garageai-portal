#!/usr/bin/env bash
# Turns query results of the encrypted export (rows: name, n, d = base64 PGP message of the
# table's row_to_json lines) into files/<schema>.<table>.jsonl and files/manifest.json.
# Usage: unpack.sh <result.json>...   Nothing is printed but table names and counts.
set -euo pipefail
cd "$(dirname "$0")"; export GNUPGHOME=$PWD/keys; umask 077
mkdir -p files; : > work/manifest.lines
for f in "$@"; do
  while IFS=$'\t' read -r name n; do
    [[ "$name" =~ ^[a-z_]+\.[a-z_][a-z0-9_]*$ ]] || { echo "bad name: $name" >&2; exit 1; }
    jq -r --arg t "$name" '.rows[] | select(.name == $t) | .d' "$f" | base64 -d \
      | gpg --batch --quiet --decrypt 2>/dev/null > "files/$name.jsonl"
    [[ ! -s "files/$name.jsonl" ]] || sed -i -e '$a\' "files/$name.jsonl"
    lines=$(wc -l < "files/$name.jsonl")
    [[ "$lines" == "$n" ]] || { echo "$name: query counted $n rows, file has $lines" >&2; exit 1; }
    jq -c . "files/$name.jsonl" > /dev/null || { echo "$name: a line is not JSON" >&2; exit 1; }
    printf '%s\t%s\n' "$name" "$n" >> work/manifest.lines
    printf '%-45s %8s rows %10s bytes\n' "$name" "$n" "$(stat -c %s "files/$name.jsonl")"
  done < <(jq -r '.rows[] | select(.name != "0") | [.name, .n] | @tsv' "$f")
done
jq -Rn --arg at "$(date -u +%FT%TZ)" '{source: "lovable-cloud sjopaiquzqotymqmrcke", exported_at: $at,
  tables: [inputs | split("\t") | {table: .[0], rows: (.[1] | tonumber), file: (.[0] + ".jsonl")}]}' \
  work/manifest.lines > files/manifest.json
chmod 644 files/*; echo "tables: $(jq '.tables | length' files/manifest.json), rows: $(jq '[.tables[].rows] | add' files/manifest.json)"
