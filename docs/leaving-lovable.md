# Leaving Lovable: moving the portal to Shipholm

Status 2026-11-26: decided direction, nothing moved yet. Done: step 0 (the schema in one file,
[`db/`](../db/README.md)), step 1 (the gateway calls `portal.garageai.eu`, garageai#277) and the
platform part of step 2 that could be done off the cluster (database roles, shipholm#94).
Open in step 2: a tested Postgres restore on Shipholm.

## Goal

GarageAI owns the portal's data and runs it on infrastructure it controls. Lovable Cloud (its
Supabase project, its hosting, its OAuth broker) goes; the code stays in this repository.
The gateway (LiteLLM) stays on its own VPS; only the portal moves.

## How we work: no long-lived migration branch

Lovable commits to `main` all the time. A branch that holds "the migration" would drift from it
within days. Instead:

1. **The portal code changes in small PRs to `main`**, each one working on both hosts: on
   Lovable today and on Shipholm later. Anything host-specific is read from configuration
   (`VITE_SUPABASE_URL` already is), never hard-coded.
2. **The new host is built beside the old one**, as one app in a `garageai` tenant on Shipholm,
   in the Shipholm repository (generated with `agentbuild`, as every Shipholm app is). It deploys
   the same `main`.
3. **A rehearsal environment** on Shipholm (`staging`) runs from `main` against a database built
   from `db/schema.sql` with test accounts, never production data, until everything works.
4. **The cutover** is one evening: Lovable edits frozen, data copied, `portal.garageai.eu` (the
   proxy on the gateway VPS) and `app.garageai.eu` pointed at Shipholm, Lovable kept as it is
   for a week as the way back.

## Target: Supabase-compatible, self-hosted

The frontend talks to Supabase directly: 46 table reads (`.from`), 43 RPCs, 28 function calls,
and Supabase Auth. Rewriting all of that against an API of our own is a project of its own and
not needed to own the data. So the first move keeps the frontend's contract and replaces what
answers it. Rewrites can come later, one call at a time.

| Today (Lovable Cloud) | On Shipholm | Notes |
|---|---|---|
| Postgres 17.6 | the app's own CNPG Postgres, `db_roles="supabase"` | roles `anon`, `authenticated`, `service_role` (shipholm#94) |
| Auth (GoTrue) | `supabase/gotrue`, in the app's image | carries `auth.users` with password hashes unchanged |
| PostgREST | `postgrest/postgrest`, in the app's image | RLS works as today: same roles, same `auth.uid()` |
| Edge functions (62, Deno) | `supabase/edge-runtime`, in the app's image | serves this repo's `supabase/functions` |
| Hosting of the Vite build | static files, in the app's image | `vercel.json` rewrites (robots, sitemap) become routes |
| Storage (one bucket, 2 calls) | the app's `/data` disk, or S3 | too small to bring Supabase Storage |
| pg_cron (11 jobs) | a scheduler in the app's image | the jobs' commands are in `db/schema.sql` |
| Lovable's Google sign-in broker | our own Google OAuth client in GoTrue | see "Sign-in" |
| `@lovable.dev/cloud-auth-js` | `supabase.auth.signInWithOAuth` | one file, `src/integrations/lovable/index.ts` |

**One app, not three.** GoTrue, PostgREST, the edge runtime and the frontend run in one image
behind one small reverse proxy on `$PORT`: `/auth/v1`, `/rest/v1`, `/functions/v1` and the
static files, as Supabase has it, so `VITE_SUPABASE_URL` points at the app's own address and
the frontend does not notice. One app means nothing has to share a database and the cron jobs
need no platform feature. Shipholm runs the pod as uid 10001 with a read-only root file system
(`/tmp` writable), which the image must be built for.

### Tried off the cluster (2026-11-26)

On `postgres:17` with a non-superuser owner, as CNPG creates it, and only test accounts:

- GoTrue v2.186.0 ran its 67 migrations as the owner, once the `auth` schema existed.
- `db/schema.sql` restored as the owner (without cron, pg_net and storage): 51 tables,
  90 functions, 55 policies, 24 triggers, the one on `auth.users` included.
- [`db/grants.sql`](../db/grants.sql) is needed after it: the dump has no grants.
- PostgREST v13.0.7 served it. Two signed-up users each saw only their own profile, anon saw
  none, `service_role` saw all. The sign-up trigger refused an account without accepted terms,
  as in production.
- GoTrue needs `GOTRUE_JWT_AUD=authenticated` and `GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated`;
  without them the token's `role` is empty and PostgREST refuses it.

The image itself (2026-11-27, [`deploy/shipholm/`](../deploy/shipholm/README.md)): built, and run
locally the way Shipholm runs a pod. Sign-up, sign-in, RLS, all 60 functions and the scheduled
jobs work through the one address. Still not tried: Google sign-in, anything with the gateway's
keys or Stripe, and the image on Shipholm.

### Restoring Postgres on Shipholm (passed 2026-11-27)

Shipholm had no restore for CNPG; the Shipholm session built it (`backup_database`,
`restore_database`, `database_restore_status`, `finish_database_restore`; Shipholm's README,
"Restoring Postgres") and tried it on the staging database:

- a copy as of a point in time (three seconds before a marker row): the same accounts,
  identities and profiles by md5, 71 tables, 90 functions, 55 policies, the roles, no marker;
- a copy of the latest state: identical including the marker, so the log after the base backup
  is replayed;
- the app switched onto the restored cluster and the old one removed.

From outside afterwards: both test accounts sign in with their passwords, RLS as before, a
session from before the restore is still valid, the functions answer. A copy was ready about
90 seconds after it was asked for, on a nearly empty database; to be timed again with real
data.

## Sign-in: the one thing that touches users

Google sign-in goes through Lovable's broker (`@lovable.dev/cloud-auth-js`), with Lovable's
Google OAuth client. That client cannot come along. 21 of 27 accounts sign in this way
(2026-11-26); the other 6 have a password.

- We create our own Google OAuth client (Google Cloud console, owner: GarageAI) with the new
  callback, and configure it in GoTrue. The code for it is in place (2026-11-27,
  `deploy/shipholm/README.md`, "Google sign-in"); the client itself is Magnus's to create.
- `auth.identities` holds each of the 21 users' Google subject id (checked: all numeric Google
  `sub` values, not Lovable ids), and Google's `sub` is the same for a user across OAuth
  clients, so GoTrue matches existing accounts on the first sign-in. To be verified in the
  rehearsal with a real Google account before the cutover.
- Password accounts move with their bcrypt hashes and need nothing.
- Sessions do not move: everyone signs in once after the cutover. The JWT secret changes.

## Things the cutover must re-point

From [`db/README.md`](../db/README.md) and the notes on what an exit must carry:

- Edge function secrets: LiteLLM keys, the gateway key, Stripe keys, Brevo, the cron secret.
  The `event-mail` cron job has a Bearer token written into the job; it gets a new one.
- Stripe's webhook URL (`stripe-webhook`).
- The gateway's `GARAGEAI_PORTAL_URL` (still the Supabase URL; should be `portal.garageai.eu`
  before the move, then nothing on the gateway changes at cutover).
- Doors: already on `portal.garageai.eu` since v1.7.0, with the Supabase URL as fallback. The
  fallback stops working after the cutover; Doors older than v1.7.0 need an update first.
- The cron jobs' URLs (they name the Supabase project).
- `vercel.json`'s rewrites, which name the Supabase project.

## Who does what

Agreed 2026-11-27 between the two Claude Code sessions that do the work, to be confirmed by Magnus:

| | Shipholm session (Magnus's Mac, access to the cluster) | Gateway session (gateway VPS, this repo) |
|---|---|---|
| Repos | `shipholm`: review, merge (only on Magnus's word) | `garageai-portal`, `garageai`: PRs and merges |
| Platform | tenant, apps, builds, limits, domains, certificates, capacity | – |
| Postgres | the restore tool for CNPG and its test | the schema snapshot, the import format |
| Data | – (never through its machine) | reads production out of Lovable, serves the export |
| Image and code | says what the platform needs of it | `Dockerfile`, `deploy/shipholm/`, portal code |
| Cutover | app up, data in, certificate ready | `portal-proxy` switched, gateway and Door traffic checked |

Each session merges only in the repositories it works in. What one needs from the other goes as
a message, not as a push. Production secrets go through neither: Magnus enters them himself in
Shipholm's customer portal (the app's Variables tab, secret fields).

## What the platform gives the app (checked in the Shipholm repo, 2026-11-27)

- **Build**: the cluster's build service builds the root `Dockerfile` from a private repository
  once the GitHub App is on it and the tenant has linked it. Limits: 900 s per build, 2 Gi memory
  for BuildKit, 6 Gi scratch disk; build pods reach the internet on 80/443. A 1.4 GB image has
  never gone through it: the first build is the test.
- **Postgres**: CNPG runs PostgreSQL 18 (18.7 on 2026-11-27), Lovable 17.6. The schema and
  GoTrue's migrations went in unchanged on staging.
- **Pod**: user namespace, uid 10001, read-only root, RuntimeDefault seccomp. `/tmp` is an
  emptyDir in memory, at most half the memory limit, and **counts against the limit**. Exec from
  `/tmp` should work but is not verified in a user-namespaced pod.
- **Egress**: DNS, the tenant's own namespace, other apps through Traefik, and the internet on
  TCP 80/443 except private ranges. The gateway (37.27.221.1:443) is reachable; Postgres ports
  to the outside are not.
- **Plan**: Pro fits: 8 Gi memory, 3 Postgres, always awake allowed. A Postgres instance is
  512 Mi and counts; staging and production together are about 5 Gi.
- **One app it is**: every app has its own CNPG cluster, so GoTrue and PostgREST as separate apps
  could not share the database.
- **Deploys**: a new pod is up before the old one stops, and a version that does not become
  ready is rolled back to the last live one.
- **Domains**: `add_domain` gives a TXT record to verify while DNS still points at Lovable. The
  certificate of a custom domain is HTTP-01, so it comes a minute or two after the DNS switch,
  unless the zone is added to the cluster's DNS-01 issuer first (possible when garageai.eu's
  Cloudflare zone is reachable with Shipholm's DNS token).

## What the image still owes the platform

All five done in the image 2026-11-27 and tried locally (`deploy/shipholm/README.md`); the
image is 678 MB. What they were:

1. **Cron must not run twice** while two pods overlap in a deploy: each job claims its time
   slot in a table before it runs (one row per job and slot; the pod that inserts it runs).
2. **Bake the functions' module cache into the image** (read-only `DENO_DIR`) instead of
   fetching from esm.sh, npm and deno.land on first call: faster start, no dependency on those
   hosts at run time, nothing in `/tmp`.
3. **`/healthz` answers only when Caddy, GoTrue and PostgREST are up** (not the functions), so
   the deploy watch sees a real readiness.
4. **A smaller image** if the edge runtime allows it (it is 1.1 GB of the 1.4).
5. **The one-shot import** below.

## How production data moves

No tool on either side holds a connection string to Lovable Cloud's database, and Shipholm's
databases are not reachable from outside. So the app imports itself:

1. The gateway session reads every table of `public`, plus `auth.users` (with
   `encrypted_password`) and `auth.identities`, out of Lovable with one read-only query
   (`deploy/shipholm/export/export.sql`). The database itself encrypts each table's rows with a
   public key (pgcrypto, `pgp_pub_encrypt`); the private key exists only on the gateway VPS. So
   what passes through the query tool, and the session that runs it, is ciphertext. `unpack.sh`
   decrypts on the VPS into one file per table plus `manifest.json`, checking each file's line
   count against the count the query made. Passwords and Google links survive.
2. The files are served from the gateway VPS at `https://portal.garageai.eu/_export/` behind a
   bearer token (`deploy/shipholm/export/docker-compose.yml`), up only for the import. Magnus
   copies the token from the VPS into the app's settings himself.
3. The image gets a one-shot import (`PORTAL_IMPORT_URL`, `PORTAL_IMPORT_TOKEN`): it runs as the
   database owner, only into tables without rows, in one transaction, and records that it ran.
   Both variables are removed afterwards, the files deleted, the server stopped. Details in
   [deploy/shipholm/README.md](../deploy/shipholm/README.md), "The data import".
4. Row counts per table are compared with Lovable before anything is switched.

Data passes through no chat, no git and neither session's conversation. If Lovable's support
hands out a connection string, `pg_dump` on the gateway VPS replaces step 1; the rest stays.

Every session ends at the cutover (the JWT secret is new): users sign in once more. Tell them.

## Order

0. ~~Schema in one restorable file~~ (`db/`, done 2026-11-26).
1. ~~Gateway: `GARAGEAI_PORTAL_URL` to `portal.garageai.eu`~~ (done 2026-11-26). Doors: all on
   v1.7.0 except `tool` (v1.0.3, offline).
2. ~~The image~~ (`deploy/shipholm/`, runs locally, 2026-11-27) and ~~database roles~~
   (shipholm#94, merged 2026-11-27: `db_roles="supabase"` is live on the platform).
3. **Before the rehearsal** – Magnus: which tenant (recommended: a new GarageAI account on Pro),
   the GitHub App installed on `garageai-portal`. Shipholm session: link the repository, backup
   on for the app. Gateway session: ~~the five image items above~~; merge #5 and #6.
   The workspace exists: tenant `wdtg8rw9` ("GarageAI", Pro), repository linked.
   **Up since 2026-11-27**: https://garageai-portal-staging.shipholm.dev, built on the first
   attempt within the limits; from outside: sign-up, sign-in, RLS and all 60 functions behave
   as locally; 109 Mi idle.
4. **Rehearsal app** `garageai-portal-staging`: `database=true`, `db_roles="supabase"`, 2 Gi,
   always awake, `health_path=/healthz`, `GOTRUE_MAILER_AUTOCONFIRM=true`, `PORTAL_CRON=off`, no
   production keys. The Shipholm session verifies on the cluster (roles created, build limits,
   exec from `/tmp`, memory); the gateway session tests from outside and fixes the image.
5. In parallel, none waiting for the other:
   - ~~Shipholm session: the Postgres restore tool (recover an app's database from its S3
     backup into a new cluster), with the rehearsal database as its first user.~~ Done.
   - Gateway session: portal code that works on both hosts (Google sign-in without Lovable's
     broker behind a setting, robots/sitemap, storage). Magnus: our own Google OAuth client.
   - ~~Data rehearsal: a full copy of production through the import, row counts compared,
     timed.~~ Done 2026-11-27 into a second app, `garageai-portal-rehearsal` (a new app with an
     empty database, as on the cutover evening): 138 347 rows in 53 tables, every table's count
     equal to the export's, 52 foreign keys validated, about 12 s on PostgreSQL 18.7 (the start
     limit is 120 s). Magnus signed in there with his password account. Order of the two
     settings: `PORTAL_IMPORT_TOKEN` first, `PORTAL_IMPORT_URL` last (the URL alone stops the
     container). The rehearsal app is deleted before the production app is created.
6. **Gate**: ~~the restore test has passed~~ (2026-11-27), ~~the data rehearsal matches~~
   (2026-11-27), Google sign-in works with an existing account (needs our own OAuth client).
7. **Cutover evening**: Lovable edits frozen; production app created (consider
   `db_instances: 2`, `db_size` with headroom); Magnus enters the production secrets; final
   import; certificate ready (DNS-01 if the zone was added, otherwise right after the switch);
   DNS `app.garageai.eu` → Shipholm; gateway session switches `PORTAL_UPSTREAM_HOST` in
   `portal-proxy` and checks heartbeats, gateway calls and a paid request; Stripe's webhook URL
   re-pointed. Lovable left untouched for a week as the way back, then Lovable Cloud closed.

Lovable can keep editing the frontend through GitHub after the move; it just no longer runs
the backend.
