# The portal as one app for Shipholm (docs/leaving-lovable.md): the built frontend, GoTrue
# (/auth/v1), PostgREST (/rest/v1) and the edge functions (/functions/v1) behind one Caddy on
# $PORT, all against the app's own Postgres (DATABASE_URL, created with db_roles="supabase").
# Lovable does not use this file. Everything it needs beside the code is in deploy/shipholm/.
#
# Runs as any non-root user with a read-only root file system; only /tmp is written to.

FROM node:22-bookworm-slim AS web
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN HUSKY=0 pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Placeholders: the real address and key are only known when the container starts
# (deploy/shipholm/entrypoint.sh puts them into a copy of the build).
ENV VITE_SUPABASE_URL=https://portal-public-url.invalid \
    VITE_SUPABASE_PUBLISHABLE_KEY=PORTAL_ANON_KEY_PLACEHOLDER \
    VITE_SUPABASE_PROJECT_ID=shipholm \
    VITE_GOOGLE_SIGN_IN=supabase \
    NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm exec vite build
RUN node deploy/shipholm/prepare.mjs

FROM supabase/gotrue:v2.186.0 AS gotrue
FROM postgrest/postgrest:v13.0.7 AS postgrest
FROM caddy:2.10.2 AS caddy
# The binary carries a file capability (bind to low ports). A pod that drops all capabilities
# and forbids new privileges refuses to start such a file, so take a plain copy.
RUN cp /usr/bin/caddy /caddy-plain

FROM supabase/edge-runtime:v1.69.28 AS edge

# Debian slim with only the runtime's binary: the runtime's own image also carries a debug
# build and math libraries the portal's functions never load (1.1 GB against 160 MB).
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash ca-certificates curl jq openssl postgresql-client \
    && rm -rf /var/lib/apt/lists/*
ADD --chmod=755 https://github.com/aptible/supercronic/releases/download/v0.2.51/supercronic-linux-amd64 /usr/local/bin/supercronic
COPY --from=edge /usr/local/bin/edge-runtime /usr/local/bin/edge-runtime
COPY --from=gotrue /usr/local/bin/auth /usr/local/bin/auth
COPY --from=gotrue /usr/local/etc/auth/migrations /usr/local/etc/auth/migrations
COPY --from=postgrest /bin/postgrest /usr/local/bin/postgrest
COPY --from=caddy /caddy-plain /usr/local/bin/caddy

WORKDIR /app
COPY --from=web /src/dist /app/www
COPY --from=web /src/deploy/shipholm/out/ /app/generated/
COPY supabase/functions /app/functions
COPY deploy/shipholm/main /app/functions/main
COPY deploy/shipholm/entrypoint.sh deploy/shipholm/cron-call.sh deploy/shipholm/import.sh \
     deploy/shipholm/bake-modules.sh deploy/shipholm/Caddyfile deploy/shipholm/crontab /app/
COPY db/grants.sql /app/generated/grants.sql
RUN chmod 755 /app/*.sh && auth version && postgrest --version && caddy version && edge-runtime --version
# The functions' imports (esm.sh, npm, deno.land) are fetched now, into the image, so a start
# needs none of those hosts and nothing is written at run time.
RUN /app/bake-modules.sh

ENV PORT=8080 HOME=/tmp DENO_DIR=/app/deno-cache
USER 10001:10001
ENTRYPOINT ["/app/entrypoint.sh"]
