// Build-time helper for the Shipholm image (run by the Dockerfile's web stage):
//  out/schema.sql      db/schema.sql without what stays behind on Supabase (pg_cron, pg_net,
//                      the storage schema): what a database of our own is created from when empty
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("deploy/shipholm/out", { recursive: true });

let sql = readFileSync("db/schema.sql", "utf8");
sql = sql.replace(/^CREATE EXTENSION IF NOT EXISTS pg_(cron|net);\n/gm, "");
const cut = sql.indexOf("-- Storage buckets");
if (cut < 0) throw new Error("db/schema.sql: no 'Storage buckets' section – has the snapshot's layout changed?");
sql = sql.slice(0, sql.lastIndexOf("-- ====", cut));          // drops buckets and cron jobs
sql = sql.split(";\n").filter((stmt) => !stmt.includes("ON storage.objects")).join(";\n");
for (const left of ["cron.schedule", "storage.", "net.http_post"]) {
  if (sql.includes(left)) throw new Error(`db/schema.sql still refers to ${left} after trimming`);
}
writeFileSync("deploy/shipholm/out/schema.sql", sql);

console.log(`schema.sql ${sql.length} bytes`);
