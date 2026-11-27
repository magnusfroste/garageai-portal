#!/usr/bin/env bash
# Build time only (Dockerfile): starts every function once so the runtime downloads its imports
# into DENO_DIR, which then ships in the image. The functions answer with errors here (no
# database, no keys); only the downloads matter. A dozen at a time, so the build stays small
# in memory.
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
for ((i = 0; i < ${#names[@]}; i += 12)); do
  serve
  for name in "${names[@]:i:12}"; do
    code=$(curl -s -m 180 -o /dev/null -w '%{http_code}' "http://127.0.0.1:9000/$name" || true)
    [[ "$code" != 000 ]] || { echo "function $name did not answer while baking" >&2; cat /tmp/bake.log >&2; exit 1; }
  done
  halt
done
rm -f /tmp/bake.log
chmod -R a+rX "$DENO_DIR"
echo "baked the imports of ${#names[@]} functions: $(du -sh "$DENO_DIR" | cut -f1)"
