# db/ – the portal's live schema, in one file

`schema.sql` is the portal database's schema as it actually is in production, read from the
Lovable Supabase project. It exists so that the portal can be moved off Lovable without
replaying the migration history, and so that anyone can see the whole database in one place.

It is a **snapshot, not a migration**. Never copy it into `supabase/migrations/` or
`drizzle/migrations/`: Lovable applies what is in those folders. The history stays there.

## What is in it (2026-11-26)

| | |
|---|---|
| Tables | 51 (536 columns), all with row-level security |
| Constraints | 140 keys, unique and check constraints, 36 foreign keys |
| Indexes | 36 besides those of the constraints (99 in all) |
| Functions | 90 (34 in SQL, the rest PL/pgSQL) |
| Triggers | 24, one of them on `auth.users` (`on_auth_user_created`) |
| Policies | 59, four of them on `storage.objects` |
| Storage | one bucket, `site-assets` |
| Cron jobs | 11 |
| Extensions | uuid-ossp, pgcrypto, pg_cron, pg_net, supabase_vault |

No data. No grants: Supabase's default grants to `anon`, `authenticated` and `service_role`
apply. Supabase's own triggers on `storage.*` are left out.

## Compared with the migrations in this repo

All 51 tables and all 90 functions appear in `supabase/migrations/` (43 files, the early
history) and `drizzle/migrations/` (106 files, from Lovable's switch to Drizzle). **The 11 cron
jobs appear in neither**: Lovable created them outside the migrations. This file is the only
record of them in the repo.

The cron jobs call edge functions at `https://sjopaiquzqotymqmrcke.supabase.co/functions/v1/…`.
Ten authenticate with `x-cron-secret`, read at run time from `public.internal_secrets`
(`sync_models_cron_secret`). `event-mail` instead carries a Bearer token written into the job
itself; it is redacted here (`<REDACTED>`). On another host both the URLs and that token have to
be set anew.

## Regenerating

1. Run `dump-schema.sql` against the database. It only uses `SELECT` and returns one row per
   object: `s` (section), `k` (name), `ddl`. Lovable's `query_database` tool works, as does
   `psql`. Save the result as JSON `{"rows": [...]}`.
2. `python3 db/build_schema.py result.json db/schema.sql`

The script puts the sections in restore order (functions before tables, with
`check_function_bodies = false` as `pg_dump` does) and redacts any Bearer token it finds.

## How it was tested

Restored onto an empty `postgres:17` (the production server runs 17.6) after `test-stubs.sql`.
The stubs are minimal stand-ins for what Supabase provides: the roles, `auth.users`,
`auth.uid()`, `auth.role()`, `storage.buckets/objects`, `cron.schedule`, `net.http_post`.
Result, with `ON_ERROR_STOP=1`: no errors, and the restored database has exactly the counts above
(51 / 90 / 59 / 99 / 24 / 536 / 11). The function bodies were then re-created with
`check_function_bodies = on` against the restored tables, also without errors.

```bash
docker run -d --name schematest -e POSTGRES_PASSWORD=x postgres:17
docker exec -i schematest psql -U postgres -v ON_ERROR_STOP=1 < db/test-stubs.sql
sed -E '/CREATE EXTENSION IF NOT EXISTS pg_(cron|net)/d' db/schema.sql \
  | docker exec -i schematest psql -U postgres -v ON_ERROR_STOP=1
```

On a real Supabase, run `schema.sql` as is (pg_cron and pg_net are available there).

`grants.sql` holds the privileges Supabase gives by default (the snapshot has none); run it as the
database owner after `schema.sql` on a host of our own. See [docs/leaving-lovable.md](../docs/leaving-lovable.md).
