import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { chownSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

const directory = mkdtempSync(join(tmpdir(), "event-mail-test-"));
const asRoot = process.getuid?.() === 0;
const nonRoot = readFileSync("/etc/passwd", "utf8").split("\n").map(line => line.split(":" )).find(fields => Number(fields[2]) > 0 && Number(fields[2]) < 65534);
if (asRoot && !nonRoot) throw new Error("Disposable PostgreSQL requires a non-root account");
if (asRoot) chownSync(directory, Number(nonRoot?.[2]), Number(nonRoot?.[3]));
const command = (args: string[]) => {
  const result = Bun.spawnSync(asRoot ? ["setpriv", `--reuid=${nonRoot?.[2]}`, `--regid=${nonRoot?.[3]}`, "--clear-groups", ...args] : args);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || result.stdout.toString());
};
const sql = postgres({ host: directory, port: 5432, user: "event_test", database: "postgres", max: 1 });
let started = false;
const user = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const garage = "00000000-0000-0000-0000-000000000003";

beforeAll(async () => {
  command(["initdb", "-D", join(directory, "data"), "-U", "event_test", "-A", "trust", "--no-locale"]);
  command(["pg_ctl", "-D", join(directory, "data"), "-l", join(directory, "server.log"), "-o", `-k ${directory} -h '' -p 5432`, "-w", "start"]);
  started = true;
  await sql.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_setting(''request.jwt.claim.role'',true)';
    CREATE TABLE public.user_roles(user_id uuid,role text);
    CREATE FUNCTION public.has_role(_id uuid,_role text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS 'SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_id AND role=_role)';
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,first_goal text,first_goal_at timestamptz);
    GRANT SELECT,UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profiles_own ON public.profiles TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE TABLE public.admin_settings(key text PRIMARY KEY,value jsonb);
    CREATE TABLE public.api_keys(user_id uuid,created_at timestamptz,key_last4 text,key_value text,litellm_token text,internal boolean DEFAULT false);
    CREATE TABLE public.buyer_first_requests(user_id uuid,first_request_at timestamptz);
    CREATE TABLE public.chat_conversations(user_id uuid,created_at timestamptz);
    CREATE TABLE public.customer_garage_model_stats_hourly(hour timestamptz,api_keys text[],requests integer,failures integer);
    CREATE TABLE public.garages(id uuid,operator_id uuid,name text,display_name text,connection_type text DEFAULT 'mesh',last_heartbeat_at timestamptz,paused_at timestamptz,paused_by_admin boolean DEFAULT false);
  `);
  const migrations = join(import.meta.dir, "../../drizzle/migrations");
  for (const suffix of ["_event_mail_storage.sql", "_event_mail_rules_and_delivery.sql"]) {
    const filename = readdirSync(migrations).find(name => name.endsWith(suffix));
    if (!filename) throw new Error("Missing event mail migration");
    await sql.unsafe(readFileSync(join(migrations, filename), "utf8"));
  }
}, 20000);
beforeEach(async () => {
  await sql.unsafe("RESET ROLE; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT set_config('request.jwt.claim.sub','',false); TRUNCATE profiles,mail_log,mail_delivery_state,api_keys,buyer_first_requests,chat_conversations,garages,customer_garage_model_stats_hourly,admin_settings,mail_templates,mail_worker_lock,user_roles CASCADE;");
  await sql`INSERT INTO profiles(id,email) VALUES(${user},'first@example.test'),(${other},'second@example.test')`;
  await sql`INSERT INTO admin_settings VALUES('event_mail','{"mode":"on","test_delay_minutes":10,"max_per_week":1,"max_total":3}'::jsonb)`;
  await sql`INSERT INTO mail_templates(key,subject_en,subject_sv,body_en,body_sv) SELECT key,'en','sv','en','sv' FROM unnest(ARRAY['first_request_nudge','connect_garage_nudge','garage_offline'])key`;
});
afterAll(async () => { await sql.end({ timeout: 1 }); if (started) command(["pg_ctl", "-D", join(directory, "data"), "-m", "immediate", "-w", "stop"]); rmSync(directory, { recursive: true, force: true }); });

async function key(age = "2 days") { await sql`INSERT INTO api_keys VALUES(${user},now()-${age}::interval,'ABCD','not-a-real-key','fixture-token',false)`; }
async function claim() { const [row] = await sql`SELECT event_mail_claim(${user},'first_request_nudge','first-key') result`; return row.result; }

test("Off returns no candidates or delivery claims", async () => {
  await key(); await sql`UPDATE admin_settings SET value=jsonb_set(value,'{mode}','"off"')`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  expect(await claim()).toBeNull();
  expect((await sql`SELECT count(*)::int n FROM mail_log`)[0].n).toBe(0);
});
test("first request nudge waits two days and excludes first requests and saved chats", async () => {
  await key("47 hours"); expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE api_keys SET created_at=now()-interval '2 days'`;
  expect((await sql`SELECT template_key,key_hint FROM event_mail_candidates()`)[0]).toEqual({ template_key: "first_request_nudge", key_hint: "ABCD" });
  await sql`INSERT INTO buyer_first_requests VALUES(${user},now())`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`DELETE FROM buyer_first_requests WHERE user_id=${user}`;
  await sql`INSERT INTO chat_conversations VALUES(${user},now())`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
});
test("historical successful customer usage suppresses nudges but failed/internal usage does not", async () => {
  await key(); await sql`INSERT INTO customer_garage_model_stats_hourly VALUES(now(),ARRAY[encode(extensions.digest('fixture-token','sha256'),'hex')],1,1)`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(1);
  await sql`UPDATE customer_garage_model_stats_hourly SET failures=0`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE api_keys SET internal=true`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
});
test("Test evaluates only marked accounts and uses ten minutes for every delayed rule", async () => {
  await key("11 minutes"); await sql`UPDATE admin_settings SET value=jsonb_set(value,'{mode}','"test"')`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE profiles SET mail_test=true,first_goal='share',first_goal_at=now()-interval '11 minutes' WHERE id=${user}`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(2);
  await sql`INSERT INTO garages VALUES(${garage},${user},'test garage',NULL,'mesh',now()-interval '11 minutes',NULL,false)`;
  expect((await sql`SELECT template_key FROM event_mail_candidates() ORDER BY template_key`).map(r => r.template_key)).toEqual(["first_request_nudge", "garage_offline"]);
  await sql`UPDATE api_keys SET created_at=now()-interval '9 minutes'`;
  await sql`UPDATE garages SET last_heartbeat_at=now()-interval '9 minutes'`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
});
test("connect nudge requires own_machine/share three days old and no owned garage", async () => {
  await sql`UPDATE profiles SET first_goal='own_machine',first_goal_at=now()-interval '71 hours' WHERE id=${user}`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE profiles SET first_goal_at=now()-interval '3 days' WHERE id=${user}`;
  expect((await sql`SELECT template_key FROM event_mail_candidates()`)[0].template_key).toBe("connect_garage_nudge");
  await sql`INSERT INTO garages(id,operator_id,name) VALUES(${garage},${user},'never reported')`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
});
test("offline requires a report older than three days and excludes either pause and endpoints", async () => {
  await sql`INSERT INTO garages(id,operator_id,name) VALUES(${garage},${user},'test garage')`;
  expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE garages SET last_heartbeat_at=now()-interval '3 days'`;
  const row = (await sql`SELECT * FROM event_mail_candidates()`)[0]; expect(row.template_key).toBe("garage_offline"); expect(row.days_offline).toBe(3);
  await sql`UPDATE garages SET paused_at=now()`; expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE garages SET paused_at=NULL,paused_by_admin=true`; expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
  await sql`UPDATE garages SET paused_by_admin=false,connection_type='endpoint'`; expect((await sql`SELECT * FROM event_mail_candidates()`).length).toBe(0);
});
test("dedupe and lifetime cap survive twelve-month log pruning", async () => {
  await key(); const first = await claim(); expect(first.status).toBe("ready");
  await sql`SELECT event_mail_finish(${first.log_id},true,'fixture-provider',NULL)`;
  await sql`UPDATE mail_log SET created_at=now()-interval '13 months'`;
  await sql`SELECT event_mail_prune()`;
  expect((await sql`SELECT count(*)::int n FROM mail_log`)[0].n).toBe(0);
  expect(await claim()).toBeNull();
  await sql`UPDATE mail_delivery_state SET total_sent=3,recent_sent='{}',sent_events='{}'`;
  expect((await claim()).status).toBe("skipped_cap");
});
test("weekly account cap spans templates and definite failure releases the reservation", async () => {
  await key(); const first = await claim();
  await sql`UPDATE profiles SET first_goal='share',first_goal_at=now()-interval '3 days' WHERE id=${user}`;
  expect((await sql`SELECT event_mail_claim(${user},'connect_garage_nudge','first-goal') r`)[0].r.status).toBe("skipped_cap");
  await sql`SELECT event_mail_finish(${first.log_id},false,NULL,'no mail key')`;
  const [state] = await sql`SELECT total_sent,cardinality(recent_sent) recent FROM mail_delivery_state WHERE user_id=${user}`;
  expect(state.total_sent).toBe(0); expect(state.recent).toBe(0);
  expect((await claim()).status).toBe("ready");
});
test("opt-outs skip delivery and manual tests bypass caps without consuming them", async () => {
  await key(); await sql`UPDATE profiles SET mail_opt_out_at=now() WHERE id=${user}`;
  expect((await claim()).status).toBe("skipped_opt_out");
  await sql`UPDATE profiles SET mail_opt_out_at=NULL WHERE id=${user}`;
  await sql`UPDATE mail_delivery_state SET total_sent=3`;
  const manual = (await sql`SELECT event_mail_claim(${user},'first_request_nudge','manual-test',true) r`)[0].r;
  expect(manual.status).toBe("ready");
  await sql`SELECT event_mail_finish(${manual.log_id},true,'fixture',NULL)`;
  expect((await sql`SELECT total_sent FROM mail_delivery_state WHERE user_id=${user}`)[0].total_sent).toBe(3);
  expect((await sql`SELECT event_mail_claim(${user},'first_request_nudge','manual-test',true) r`)[0].r.status).toBe("ready");
});
test("worker lease prevents overlapping runs", async () => {
  expect((await sql`SELECT event_mail_lock(${user}) got`)[0].got).toBe(true);
  expect((await sql`SELECT event_mail_lock(${other}) got`)[0].got).toBe(false);
  await sql`SELECT event_mail_lock(${user},true)`;
  expect((await sql`SELECT event_mail_lock(${other}) got`)[0].got).toBe(true);
});
test("ordinary accounts cannot mark test accounts read mail logs or run delivery RPCs", async () => {
  await sql`SELECT set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claim.sub',${user},false)`;
  await sql.unsafe("SET ROLE authenticated");
  expect((await sql`SELECT count(*)::int n FROM mail_templates`)[0].n).toBe(0);
  await expect(sql`UPDATE profiles SET mail_test=true WHERE id=${user}`).rejects.toThrow();
  await expect(sql`SELECT set_mail_test(${user},true)`).rejects.toThrow();
  await expect(sql`SELECT event_mail_claim(${user},'first_request_nudge','first-key')`).rejects.toThrow();
  await sql`UPDATE profiles SET mail_language='sv',mail_opt_out_at=now() WHERE id=${user}`;
  expect((await sql`SELECT mail_language,mail_opt_out_at IS NOT NULL opted_out FROM profiles WHERE id=${user}`)[0]).toEqual({ mail_language: "sv", opted_out: true });
  expect((await sql`SELECT count(*)::int n FROM profiles WHERE id=${other}`)[0].n).toBe(0);
});