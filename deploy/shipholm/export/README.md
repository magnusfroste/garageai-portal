# Export tooling (gateway VPS side of the data move)

Used once per import, from a directory on the gateway VPS (`/home/garageai/portal-export`).
See [docs/leaving-lovable.md](../../../docs/leaving-lovable.md), "How production data moves".

1. Key pair, RSA (pgcrypto does not read elliptic-curve keys), in a `keys/` directory only the
   operator can read; `gpg --armor --export portal-export` gives the public half.
2. Run `export.sql` (public key filled in) against the production database. Read-only. Split
   with the `/*SPLIT*/` condition if a result grows past what the query tool returns (3 MB was
   fine on 2026-11-27). The padding row keeps even a small result out of the tool's inline output.
3. `./unpack.sh <result.json>…` writes `files/<schema>.<table>.jsonl` and `files/manifest.json`.
4. `.env` with `PORTAL_EXPORT_TOKEN` (64 hex), `docker compose up -d`, set the app's
   `PORTAL_IMPORT_URL=https://portal.garageai.eu/_export` and `PORTAL_IMPORT_TOKEN`, start it.
5. Afterwards: `docker compose down`, delete `files/`, remove both app settings.

Tried 2026-11-27 with system tables instead of customer data: encrypt in the database, decrypt
here (UTF-8 intact, counts equal), 401 without or with a wrong token, 200 with it, no listing.
