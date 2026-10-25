import { expect, test } from "bun:test";
import postgres from "postgres";
import { ACCOUNT_TERMS_VERSION } from "../../supabase/functions/_shared/accountTerms";

const canWriteFixtures = async () => {
  if (!process.env.SUPABASE_DB_URL) return false;
  const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, connect_timeout: 5 });
  try {
    const [row] = await sql`select has_table_privilege(current_user, 'public.profiles', 'UPDATE') and pg_has_role(current_user, 'authenticated', 'MEMBER') as allowed`;
    return row.allowed === true;
  } finally { await sql.end({ timeout: 1 }); }
};
const privilegedFixturesAvailable = await canWriteFixtures();

test.skipIf(!process.env.SUPABASE_DB_URL)("database current version matches the shared frontend/edge constant", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1, connect_timeout: 5, connection: { statement_timeout: 3000 } });
  try {
    const [row] = await sql`select public.account_terms_version() as version`;
    expect(row.version).toBe(ACCOUNT_TERMS_VERSION);
  } finally { await sql.end({ timeout: 1 }); }
});

test.skipIf(!process.env.SUPABASE_DB_URL)("anonymous callers cannot execute acceptance, authenticated callers can", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1, connect_timeout: 5, connection: { statement_timeout: 3000 } });
  try {
    const [row] = await sql`select has_function_privilege('anon', 'public.accept_account_terms(text)', 'EXECUTE') as anonymous, has_function_privilege('authenticated', 'public.accept_account_terms(text)', 'EXECUTE') as authenticated`;
    expect(row.anonymous).toBe(false);
    expect(row.authenticated).toBe(true);
  } finally { await sql.end({ timeout: 1 }); }
});

test.skipIf(!process.env.SUPABASE_DB_URL)("database transition keeps legacy access until 9 November UTC", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1, connect_timeout: 5 });
  try {
    // Evaluate the deployed SQL body with concrete inputs when the sandbox's
    // read-only role cannot execute authenticated-only functions directly.
    const [definition] = await sql`select prosrc from pg_proc where oid = 'public.account_terms_valid(text,timestamptz)'::regprocedure`;
    const query = definition.prosrc.replaceAll('_version', '$1::text').replaceAll('_at', '$2::timestamptz');
    for (const [version, at, expected] of [
      ['2026-10-17', '2026-11-08 23:59:59+00', true],
      ['2026-10-17', '2026-11-09 00:00:00+00', false],
      ['2026-10-25', '2026-11-09 00:00:00+00', true],
    ] as const) {
      const [row] = await sql.unsafe(query, [version, at]);
      expect(Object.values(row)[0]).toBe(expected);
    }
  } finally { await sql.end({ timeout: 1 }); }
});

test.skipIf(!privilegedFixturesAvailable)("notice dismissal and acceptance are account-scoped and persisted", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1, connect_timeout: 5 });
  try {
    // Roll back all fixture changes, including acceptance timestamps.
    await sql.begin(async tx => {
      const users = await tx`select id from public.profiles order by id limit 2`;
      if (users.length < 2) throw new Error("Two account fixtures required");
      const ownId = users[0].id;
      const otherId = users[1].id;
      await tx`update public.profiles set terms_version = '2026-10-17', terms_notice_dismissed_version = null where id in (${ownId}, ${otherId})`;
      await tx`select set_config('request.jwt.claim.sub', ${ownId}, true)`;
      await tx`set local role authenticated`;
      await tx`select public.dismiss_account_terms_notice('2026-10-25')`;
      const [own] = await tx`select terms_version, terms_notice_dismissed_version from public.profiles where id = ${ownId}`;
      expect(own.terms_version).toBe("2026-10-17");
      expect(own.terms_notice_dismissed_version).toBe("2026-10-25");
      await tx`select public.accept_account_terms('2026-10-25')`;
      const [accepted] = await tx`select terms_version, terms_accepted_at from public.profiles where id = ${ownId}`;
      expect(accepted.terms_version).toBe("2026-10-25");
      expect(accepted.terms_accepted_at).not.toBeNull();
      await tx`reset role`;
      const [other] = await tx`select terms_version, terms_notice_dismissed_version from public.profiles where id = ${otherId}`;
      expect(other.terms_version).toBe("2026-10-17");
      expect(other.terms_notice_dismissed_version).toBeNull();
      throw new Error("ROLLBACK_FIXTURE");
    }).catch(error => { if (error.message !== "ROLLBACK_FIXTURE") throw error; });
  } finally { await sql.end({ timeout: 1 }); }
});