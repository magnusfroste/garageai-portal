# deploy/shipholm – the portal as one app

The image built by the `Dockerfile` in the repository root: everything the portal needs besides
Postgres, behind one address. Plan and background: [docs/leaving-lovable.md](../../docs/leaving-lovable.md).
Lovable does not use any of this.

| Path | Answered by | |
|---|---|---|
| `/auth/v1/*` | GoTrue v2.186.0 | sign-up, sign-in, sessions |
| `/rest/v1/*` | PostgREST v13.0.7 | tables and RPCs, RLS as today |
| `/functions/v1/<name>` | `supabase/edge-runtime` v1.69.28 | this repo's `supabase/functions`, routed by `main/index.ts` |
| `/healthz` | Caddy | `200 ok`; Caddy starts last, so it answers only when sign-in and the data API are up |
| `/storage/v1/*`, `/realtime/v1/*` | Caddy | 404: not brought along |
| everything else | Caddy | the built frontend; a missing file is a 404, any other path is the app |

`entrypoint.sh` starts the parts and stops the container if one of them stops. `crontab` +
`cron-call.sh` are the eleven former pg_cron jobs minus `prune-cron-run-details` (there is no
`cron.job_run_details` to prune), run by supercronic; a job first claims its minute in
`portal_ops.cron_runs`, so two pods that overlap in a deploy run it once. `prepare.mjs` trims
`db/schema.sql` at build time into what an empty database is created from. `bake-modules.sh`
downloads the functions' imports into the image at build time. `import.sh` is the one-shot
data import (below). The base is Debian slim with only the edge runtime's binary: 678 MB.

## Settings

| Variable | |
|---|---|
| `DATABASE_URL` | the app's Postgres; it must have the roles `anon`, `authenticated`, `service_role` (Shipholm: `database=true, db_roles="supabase"`) |
| `PORTAL_JWT_SECRET` | secret, at least 32 characters; signs sessions and the two keys below |
| `PORTAL_PUBLIC_URL` | the address browsers use, e.g. `https://app.garageai.eu` |
| `PORT` | default 8080 |
| `PORTAL_IMPORT_URL`, `PORTAL_IMPORT_TOKEN` | secret, only for the import; removed afterwards |
| `PORTAL_DRAIN_SECONDS` | default 5: how long it keeps answering after the stop signal, so a deploy drops no request |
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
privileges; writes only under `/tmp` (3.5 MB: the frontend copy). Memory: about 60 MB without
traffic, about 22 MB per function that has been called in the last minutes; all 60 at once was
1.3 GB. Give it 1.5–2 Gi. The functions' imports are in the image (`/app/deno-cache`,
read-only), so a start needs no outside host; the functions themselves still call the gateway,
Stripe, Brevo and GitHub over HTTPS. Ready about 6 seconds after start on a seeded database.

## Google sign-in

This image's frontend is built with `VITE_GOOGLE_SIGN_IN=supabase`: "Continue with Google" asks
the auth server itself (`/auth/v1/authorize?provider=google`) instead of Lovable's sign-in
broker, which only exists on Lovable's hosting. A build without that variable (Lovable's) is
unchanged. Code: `src/models/services/googleSignInService.ts`, `src/data/googleSignIn.ts`.

To switch it on for an app:

1. In Google Cloud console, an OAuth client of type "Web application" owned by GarageAI, with
   the authorised redirect URI `https://<the app's host>/auth/v1/callback` (one per host:
   staging and production each need theirs listed).
2. On the app: `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, and
   `GOTRUE_EXTERNAL_GOOGLE_SECRET` (secret).

With Google off on the server, the button shows the usual "Could not sign in with Google"
message and nothing leaves the page. The start refuses to run with `ENABLED=true` and a
missing id or secret.

## The data import

Set `PORTAL_IMPORT_URL` (a directory with `manifest.json` and one `<schema>.<table>.jsonl` per
table, one `row_to_json` row per line) and `PORTAL_IMPORT_TOKEN` (sent as a Bearer token). At
the next start, after the schema exists and before the data API starts, `import.sh` loads
every table in one transaction as the database owner:

- every listed table must be empty, and its file must have exactly the manifest's row count;
- user triggers are off while loading (`handle_new_user` would create the profiles twice);
- the loaded tables' foreign keys are dropped first and put back at the end, where Postgres
  checks them all, so table order and circular keys do not matter;
- generated columns are left to Postgres, columns the export does not have keep their defaults;
- sequences are moved past the highest id;
- rows are streamed table by table straight into `psql`; nothing is stored in `/tmp`.

Any error rolls everything back and stops the container (a deploy then keeps the version that
runs). After a successful import it is recorded in `portal_ops.imports` and never runs again;
remove the two variables.

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
- Stop signal: answered 200 for 5.5 s more, then refused new requests; a request that takes 8 s
  and started 3.5 s after the signal finished with 200 at 11.6 s; the container was gone at
  12.4 s (a pod gets 30).
- In a real browser (Chromium): the home page renders without errors and asks no Lovable host;
  sign-in through the form lands on `/onboarding` with a stored session; with a made-up Google
  client the button asks `/auth/v1/settings`, then `/auth/v1/authorize`, and the browser ends at
  `accounts.google.com` with our client id and `redirect_uri=<host>/auth/v1/callback`; with
  Google off the page stays and shows its message. A build without the variable does what
  production does today: the click goes to Lovable's `/~oauth/initiate`.
- On a network without internet: all parts start, functions answer (imports come from the
  image), `/healthz` answers only once the rest is up.
- Cron: the same job fired twice in a minute runs once ("another pod has this run").
- Import, with three test accounts exported from one database and imported into an empty one:
  every table identical (md5 over all rows, `auth.users` and `auth.identities` included), all
  52 foreign keys and all triggers back, sign-in with the old password works, a new sign-up
  afterwards creates its profile, a restart says "already done". Failure cases, each leaving
  the database untouched and the container stopped: wrong token, a row count that differs from
  the manifest, a database that already has rows.

## Known gaps

- **Google sign-in** is built (below) but has never completed a real sign-in: that needs
  GarageAI's own Google OAuth client. Whether an account that came from Lovable is recognised
  on its first Google sign-in here is still to be shown on staging.
- **`robots` and `sitemap`** build their links from the address the function sees
  (`http://127.0.0.1:8080` here); they need the public address. `vercel.json`'s rewrites are not
  served: `/robots.txt` is the static file, `/sitemap.xml` is a 404.
- **Storage**: the admin's upload of site assets (2 calls) answers 404.
- **Callers' addresses**: the functions that limit per address (`bridge-link-start`) have not
  been checked behind this proxy.
- The import has only seen small test data: not production's size, nor rows written by an
  older GoTrue than this image's.
- Not run on Shipholm yet, and nothing with the gateway's keys or with Stripe.
