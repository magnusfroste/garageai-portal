# deploy/shipholm – the portal as one app

The image built by the `Dockerfile` in the repository root: everything the portal needs besides
Postgres, behind one address. Plan and background: [docs/leaving-lovable.md](../../docs/leaving-lovable.md).
Lovable does not use any of this.

| Path | Answered by | |
|---|---|---|
| `/auth/v1/*` | GoTrue v2.186.0 | sign-up, sign-in, sessions |
| `/rest/v1/*` | PostgREST v13.0.7 | tables and RPCs, RLS as today |
| `/functions/v1/<name>` | `supabase/edge-runtime` v1.69.28 | this repo's `supabase/functions`, routed by `main/index.ts` |
| `/healthz` | Caddy | `200 ok` as soon as the container is up |
| `/storage/v1/*`, `/realtime/v1/*` | Caddy | 404: not brought along |
| everything else | Caddy | the built frontend; a missing file is a 404, any other path is the app |

`entrypoint.sh` starts the parts and stops the container if one of them stops. `crontab` +
`cron-call.sh` are the eleven former pg_cron jobs minus `prune-cron-run-details` (there is no
`cron.job_run_details` to prune), run by supercronic. `prepare.mjs` trims `db/schema.sql` at
build time into what an empty database is created from.

## Settings

| Variable | |
|---|---|
| `DATABASE_URL` | the app's Postgres; it must have the roles `anon`, `authenticated`, `service_role` (Shipholm: `database=true, db_roles="supabase"`) |
| `PORTAL_JWT_SECRET` | secret, at least 32 characters; signs sessions and the two keys below |
| `PORTAL_PUBLIC_URL` | the address browsers use, e.g. `https://app.garageai.eu` |
| `PORT` | default 8080 |
| `PORTAL_CRON=off` | no scheduled jobs (a rehearsal beside production must not send mail or sync models) |
| `GOTRUE_*`, `PGRST_*` | override the defaults in `entrypoint.sh`: SMTP, Google sign-in (`GOTRUE_EXTERNAL_GOOGLE_*`), `GOTRUE_MAILER_AUTOCONFIRM=true` for a rehearsal without mail |
| the functions' secrets | `LITELLM_MASTER_KEY`, `LITELLM_BASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MAIL_LINK_SECRET`, `BREVO_API_KEY`, `LOVABLE_CRON_SECRET` (event-mail's cron token), `SEARXNG_HEADER_NAME/VALUE` – passed to the functions as they are |

The anon key and the service key are derived from `PORTAL_JWT_SECRET` at start (the same every
start). The frontend is built with placeholders; the start puts `PORTAL_PUBLIC_URL` and the anon
key into a copy under `/tmp`. The functions get `SUPABASE_URL=http://127.0.0.1:$PORT`.

An **empty** database gets the schema from `db/schema.sql` and `db/grants.sql` at the first
start; a database with tables in `public` is left alone. In an empty database the first account
that signs up becomes admin (the portal's own rule).

## What the pod must allow

Runs as uid 10001 with a read-only root file system, all capabilities dropped and no new
privileges; writes only under `/tmp` (about 60 MB: the frontend copy and the functions' module
cache). Memory: about 60 MB without traffic, about 22 MB per function that has been called in the
last minutes; all 60 at once was 1.3 GB. Give it 1.5–2 Gi. The functions download their imports
(esm.sh, npm, deno.land) the first time each is called after a start, so the pod needs outbound
HTTPS.

## Tried locally (2026-11-27)

Run as Shipholm would run it (`--read-only --user 10001 --cap-drop ALL`), against `postgres:17`
with a non-superuser owner and the three roles, test accounts only:

- Empty database → schema created; a restart leaves it alone.
- Sign-up, sign-in and `/auth/v1/user` through the proxy; a sign-up without accepted terms is
  refused by the portal's trigger.
- `/rest/v1/profiles`: a user sees their own row, anon none, the admin all.
- All 60 functions start and answer as themselves (`get-user-budget` with a session: 200).
  Six answer 500 because no LiteLLM key was set; `prune-chat-keys` too, not looked into.
- Cron: the crontab is valid; `check-bridge-release` ran end to end with the right
  `x-cron-secret`, a wrong one gets 401; the SQL jobs run.
- SIGTERM stops everything in 4 seconds.

## Known gaps

- **Google sign-in** still goes through Lovable's broker in `src/pages/Auth.tsx`
  (`@lovable.dev/cloud-auth-js`); here it needs `supabase.auth.signInWithOAuth` and our own
  Google OAuth client. Password sign-in works.
- **`robots` and `sitemap`** build their links from the address the function sees
  (`http://127.0.0.1:8080` here); they need the public address. `vercel.json`'s rewrites are not
  served: `/robots.txt` is the static file, `/sitemap.xml` is a 404.
- **Storage**: the admin's upload of site assets (2 calls) answers 404.
- **Callers' addresses**: the functions that limit per address (`bridge-link-start`) have not
  been checked behind this proxy.
- Not run on Shipholm yet, and nothing with the gateway's keys or with Stripe.
