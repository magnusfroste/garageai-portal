# Leaving Lovable: moving the portal to Shipholm

Status 2026-11-26: decided direction, nothing moved yet. Step 0 (the schema in one file) is done:
[`db/`](../db/README.md).

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
2. **The new host is built beside the old one**, as apps in a `garageai` tenant on Shipholm,
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
| Hosting of the Vite build | static site app `portal` | `vercel.json` rewrites (robots, sitemap) become routes |
| Postgres 17.6 | CNPG Postgres of the tenant | needs platform work, below |
| Auth (GoTrue) | app `auth`: `supabase/gotrue` | carries `auth.users` with password hashes unchanged |
| PostgREST | app `rest`: `postgrest/postgrest` | RLS works as today: same roles, same `auth.uid()` |
| Edge functions (62, Deno) | app `functions`: `supabase/edge-runtime` | serves all functions from this repo's `supabase/functions` |
| Storage (one bucket, 2 calls) | the `functions` app's disk, or S3 | too small to bring Supabase Storage |
| pg_cron (11 jobs) | Kubernetes CronJobs calling `functions` | the jobs' commands are in `db/schema.sql` |
| Lovable's Google sign-in broker | our own Google OAuth client in GoTrue | see "Sign-in" |
| `@lovable.dev/cloud-auth-js` | `supabase.auth.signInWithOAuth` | one file, `src/integrations/lovable/index.ts` |

One address in front, as Supabase has: `/auth/v1`, `/rest/v1`, `/functions/v1` routed to the
three apps, so `VITE_SUPABASE_URL` points at it and the frontend does not notice.

### What Shipholm lacks today (platform work, in the Shipholm repo)

- **Database roles.** CNPG creates one owner (`app`) that is not a superuser. PostgREST and
  GoTrue need `anon`, `authenticated`, `service_role`, `authenticator` and `supabase_auth_admin`,
  and the `auth` schema. CNPG can manage roles declaratively (`spec.managed.roles`); the app-db
  template needs an option for it.
- **Extensions.** pgcrypto and uuid-ossp ship with Postgres. pg_cron and pg_net do not, and are
  not needed: the cron jobs become CronJobs, and no function uses pg_net (only the cron jobs do).
- **Several apps sharing one database.** `auth`, `rest` and `functions` must reach the
  `portal` database; today an app gets only its own `DATABASE_URL`.
- **Cron.** A scheduled-job type for apps, or the jobs run as a loop inside `functions`.
- **Tested Postgres restore.** Shipholm's README lists it as a next step. A marketplace with
  credits and payouts must not move before a restore has been done for real once.

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
1. Gateway: `GARAGEAI_PORTAL_URL` to `portal.garageai.eu`. Check Door versions in the field.
2. Shipholm platform: database roles, shared database, cron, a tested Postgres restore.
3. Rehearsal on Shipholm from `db/schema.sql`: Auth, PostgREST, functions, frontend, test
   accounts; our own Google OAuth client, verified against a real Google account.
4. Portal PRs to `main` that work on both hosts: the sign-in without Lovable's broker (behind a
   setting), robots/sitemap without `vercel.json`, the storage bucket.
5. Copy production data into the rehearsal once, to time it and compare row counts.
6. Cutover evening; Lovable kept a week; then Lovable Cloud closed.

Lovable can keep editing the frontend through GitHub after the move; it just no longer runs
the backend.
