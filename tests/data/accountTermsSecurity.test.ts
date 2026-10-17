import { expect, test } from "bun:test";
import postgres from "postgres";
import { ACCOUNT_TERMS_VERSION } from "../../supabase/functions/_shared/accountTerms";

test.skipIf(!process.env.SUPABASE_DB_URL)("database current version matches the shared frontend/edge constant", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1, connect_timeout: 5, connection: { statement_timeout: 3000 } });
  try {
    const [row] = await sql`select public.account_terms_version() as version`;
    expect(row.version).toBe(ACCOUNT_TERMS_VERSION);
  } finally { await sql.end({ timeout: 1 }); }
});

test.skipIf(!process.env.SUPABASE_DB_URL)("anonymous acceptance cannot write a profile", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1, connect_timeout: 5, connection: { statement_timeout: 3000 } });
  try {
    await expect(sql`select public.accept_account_terms('2026-10-17')`).rejects.toThrow();
  } finally { await sql.end({ timeout: 1 }); }
});