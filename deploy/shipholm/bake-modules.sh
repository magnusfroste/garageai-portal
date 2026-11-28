#!/usr/bin/env bash
# Build time only (Dockerfile): starts every function once so the runtime downloads its imports
# into DENO_DIR, which then ships in the image. The functions answer with errors here (no
# database, no keys); only the downloads matter. Four at a time (every called function stays loaded until its round ends), so the build
# stays small in memory; a round that fails is tried once more (what it downloaded is kept).
set -euo pipefail
export DENO_DIR=/app/deno-cache SUPABASE_URL=http://127.0.0.1:1 SUPABASE_ANON_KEY=build SUPABASE_SERVICE_ROLE_KEY=build
mapfile -t names < <(find /app/functions -mindepth 2 -maxdepth 2 -name index.ts -printf '%h\n' | xargs -n1 basename | grep -vx main | sort)
pid=
serve() {
  edge-runtime start --main-service /app/functions/main --ip 127.0.0.1 -p 9000 >/tmp/bake.log 2>&1 & pid=$!
  for _ in $(seq 60); do curl -s -o /dev/null http://127.0.0.1:9000/ && return; sleep 0.5; done
  echo "the functions runtime did not start" >&2; cat /tmp/bake.log >&2; exit 1
}
halt() { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
# One round: start the runtime, call the given functions, stop it. Fails if one does not answer.
round() {
  serve
  local name code ok=0
  for name in "$@"; do
    code=$(curl -s -m 180 -o /dev/null -w '%{http_code}' "http://127.0.0.1:9000/$name" || true)
    [[ "$code" != 000 ]] || { echo "function $name did not answer while baking" >&2; tail -20 /tmp/bake.log >&2; ok=1; break; }
  done
  halt
  return $ok
}
for ((i = 0; i < ${#names[@]}; i += 4)); do
  round "${names[@]:i:4}" || { echo "trying that round once more" >&2; sleep 5; round "${names[@]:i:4}"; }
done
rm -f /tmp/bake.log
chmod -R a+rX "$DENO_DIR"
echo "baked the imports of ${#names[@]} functions: $(du -sh "$DENO_DIR" | cut -f1)"
