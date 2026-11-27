-- Encrypted export of the portal's data (read-only). One row per table: name, n (rows), d (base64 PGP
-- message of the table's row_to_json lines, readable only with the private key on the gateway VPS).
-- Row "0" is padding so the result is always saved to a file, never shown. Edit the WHERE to split.
with k as (select '<the armored public key from: gpg --armor --export portal-export>'::text as key),
t as (select c.oid::regclass::text as tbl, n.nspname||'.'||c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and (n.nspname='public' or (n.nspname='auth' and c.relname in ('users','identities')))
    /*SPLIT*/),
x as (select t.name, query_to_xml(format($f$select count(*) n, encode(extensions.pgp_pub_encrypt(coalesce(string_agg(row_to_json(r)::text, E'\n'), ''), extensions.dearmor(%L), 'compress-algo=1'), 'base64') d from %s r$f$, k.key, t.tbl), false, true, '') as x from t, k)
select '0' as name, null::bigint as n, repeat('x', 300000) as d
union all
select name, (xpath('/row/n/text()', x))[1]::text::bigint, (xpath('/row/d/text()', x))[1]::text from x
order by 1
