import datetime, json, re, sys
rows = json.load(open(sys.argv[1]))["rows"]  # the query result, as {"rows": [{s, k, ddl}]}
order = [10, 20, 70, 30, 40, 50, 60, 80, 90, 100, 110, 120, 130]
titles = {10:"Types",20:"Sequences",70:"Functions (before tables, bodies not checked, as pg_dump does)",30:"Tables",40:"Primary keys, unique and check constraints",50:"Foreign keys",60:"Indexes",80:"Triggers",90:"Row-level security",100:"Policies",110:"Realtime publication",120:"Storage buckets",130:"Cron jobs (secrets redacted; URLs point at the Lovable Supabase project)"}
red = lambda s: re.sub(r"(Bearer )[A-Za-z0-9._-]+", r"\1<REDACTED>", s)
out = [f"""-- GarageAI portal: live database schema snapshot, read from the Lovable Supabase
-- project on {datetime.date.today()} with SELECT queries (db/dump-schema.sql), PostgreSQL 17.6.
-- Schema only, no data. Not a migration: never place it in supabase/ or drizzle/.
-- Restores onto Supabase (needs schemas auth/storage/cron/net/vault, roles anon/
-- authenticated/service_role); db/README.md says how it was tested.
-- Regenerate: run db/dump-schema.sql, then python3 db/build_schema.py result.json db/schema.sql

SET check_function_bodies = false;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
"""]
for s in order:
    rs = [r for r in rows if r["s"] == s and not (s == 80 and r["k"].startswith("storage."))]
    out.append(f"\n-- {'='*70}\n-- {titles[s]} ({len(rs)})\n-- {'='*70}\n")
    for r in rs:
        out.append(red(r["ddl"]).rstrip() + "\n" + ("\n" if s in (30,70) else ""))
open(sys.argv[2], "w").write("".join(out))
