# Leaving Lovable: moving the portal to Shipholm

Status 2026-11-26: decided direction, nothing moved yet. Done: step 0 (the schema in one file,
[`db/`](../db/README.md)), step 1 (the gateway calls `portal.garageai.eu`, garageai#277) and the
platform part of step 2 that could be done off the cluster (database roles, shipholm#94).
Step 3's image exists and runs locally (`deploy/shipholm/`). The tested Postgres restore on
Shipholm (step 2) is parked until the portal runs there; it must be done before real data moves.

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

### What Shipholm still lacks

- **A tested Postgres restore.** Shipholm's README lists it as a next step. A marketplace with
  credits and payouts must not move before a restore from S3 has been done for real once.

## Sign-in: the one thing that touches users

Google sign-in goes through Lovable's broker (`@lovable.dev/cloud-auth-js`), with Lovable's
Google OAuth client. That client cannot come along. 21 of 27 accounts sign in this way
(2026-11-26); the other 6 have a password.

- We create our own Google OAuth client (Google Cloud console, owner: GarageAI) with the new
  callback, and configure it in GoTrue.
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

## Order

0. ~~Schema in one restorable file~~ (`db/`, done 2026-11-26).
1. ~~Gateway: `GARAGEAI_PORTAL_URL` to `portal.garageai.eu`~~ (done 2026-11-26). Doors: all on
   v1.7.0 except `tool` (v1.0.3, offline).
2. Shipholm platform: ~~database roles~~ (shipholm#94), a tested Postgres restore.
3. ~~The image (GoTrue, PostgREST, edge runtime, frontend, proxy, scheduler) in this repo~~
   (`deploy/shipholm/`, 2026-11-27), and a rehearsal app on Shipholm from `db/schema.sql` + `db/grants.sql` with test accounts; our own
   Google OAuth client, verified against a real Google account.
4. Portal PRs to `main` that work on both hosts: the sign-in without Lovable's broker (behind a
   setting), robots/sitemap without `vercel.json`, the storage bucket.
5. Copy production data into the rehearsal once, to time it and compare row counts.
6. Cutover evening; Lovable kept a week; then Lovable Cloud closed.

Lovable can keep editing the frontend through GitHub after the move; it just no longer runs
the backend.
