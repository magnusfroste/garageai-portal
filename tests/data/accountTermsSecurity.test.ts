import { expect, test } from "bun:test";
import postgres from "postgres";

test.skipIf(!process.env.SUPABASE_DB_URL)("signup, own-user acceptance, timestamp protection and retention run transactionally", async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
  const owner = "af82067e-865f-45cc-9b7a-e38e7e854a21";
  const other = "af82067e-865f-45cc-9b7a-e38e7e854a22";
  try {
    await sql.begin(async tx => {
      await expect(tx.savepoint(async sp => {
        await sp`insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values (${owner}, 'terms-rollback-only@example.invalid', '{"provider":"email"}', '{}')`;
      })).rejects.toThrow("Please accept");
      await tx`insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values (${owner}, 'terms-rollback-only@example.invalid', '{"provider":"email"}', '{"account_terms_accepted":true,"account_terms_version":"2026-10-17"}')`;
      const [signup] = await tx`select terms_version, terms_accepted_at = now() as server_time from public.profiles where id=${owner}`;
      expect(signup.terms_version).toBe("2026-10-17");
      expect(signup.server_time).toBe(true);
      await tx`insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values (${other}, 'terms-oauth-rollback-only@example.invalid', '{"provider":"google"}', '{}')`;
      await tx`select set_config('request.jwt.claim.sub', ${other}, true)`;
      await tx`set local role authenticated`;
      await expect(tx.savepoint(async sp => { await sp`select public.accept_account_terms('2026-10-16')`; })).rejects.toThrow("Current terms");
      await expect(tx.savepoint(async sp => { await sp`update public.profiles set terms_version='2026-10-17', terms_accepted_at=now() where id=${other}`; })).rejects.toThrow("Use accept_account_terms");
      await tx`select public.accept_account_terms('2026-10-17')`;
      const [accepted] = await tx`select terms_version, terms_accepted_at = now() as server_time from public.profiles where id=${other}`;
      expect(accepted.terms_version).toBe("2026-10-17");
      expect(accepted.server_time).toBe(true);
      const inaccessible = await tx`select id from public.profiles where id=${owner}`;
      expect(inaccessible.length).toBe(0);
      await tx`reset role`;
      const [unchanged] = await tx`select terms_accepted_at = now() as unchanged from public.profiles where id=${owner}`;
      expect(unchanged.unchanged).toBe(true);
      const [retention] = await tx`select public.prune_onboarding_events() as removed`;
      expect(Number(retention.removed)).toBe(0);
      throw new Error("rollback test fixtures");
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "rollback test fixtures") throw error;
  } finally { await sql.end(); }
});