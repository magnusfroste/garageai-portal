import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { chownSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { gt, valid } from "semver";

mock.module("npm:semver@7.8.5", () => ({ gt, valid }));
const { pickStable } = await import("../../supabase/functions/_shared/bridgeUpdate.ts");
const root = join(import.meta.dir, "../..");
const migrationName = readdirSync(join(root, "drizzle/migrations")).find(name => name.endsWith("_bridge_run_error_recovery.sql"));
const migrationPath = process.env.BRIDGE_RUN_MIGRATION_FILE ?? (migrationName ? join(root, "drizzle/migrations", migrationName) : "");
const migration = readFileSync(migrationPath, "utf8");
const directory = mkdtempSync(join(tmpdir(), "bridge-run-test-"));
const asRoot = process.getuid?.() === 0;
const nonRoot = readFileSync("/etc/passwd", "utf8").split("\n").map(line => line.split(":"))
  .find(fields => Number(fields[2]) > 0 && Number(fields[2]) < 65534);
if (asRoot && !nonRoot) throw new Error("A non-root account is required for disposable PostgreSQL");
const uid = Number(nonRoot?.[2]);
const gid = Number(nonRoot?.[3]);
if (asRoot) chownSync(directory, uid, gid);
const command = (args: string[]) => {
  const result = Bun.spawnSync(asRoot ? ["setpriv", `--reuid=${uid}`, `--regid=${gid}`, "--clear-groups", ...args] : args);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || result.stdout.toString());
};
const sql = postgres({ host: directory, port: 5432, user: "bridge_test", database: "postgres", max: 1 });
let started = false;
const garageM4 = "00000000-0000-0000-0000-000000000004";
const garageM1 = "00000000-0000-0000-0000-000000000001";
const setting = { stable: "v1.4.3", mode: "auto" as const, auto_after_hours: 24 };

beforeAll(async () => {
  command(["initdb", "-D", join(directory, "data"), "-U", "bridge_test", "-A", "trust", "--no-locale"]);
  command(["pg_ctl", "-D", join(directory, "data"), "-l", join(directory, "server.log"), "-o", `-k ${directory} -h ''`, "-w", "start"]);
  started = true;
  // Disposable PostgreSQL only: no production connection or application fixtures.
  await sql.unsafe(`
    CREATE TABLE public.garages (id uuid PRIMARY KEY, name text, operator_id uuid, canary boolean);
    CREATE TABLE public.user_roles (user_id uuid, role text);
    CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql AS
      'SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)';
  `);
  const original = readFileSync(join(root, "drizzle/migrations/0061_bridge_release_runs.sql"), "utf8");
  await sql.unsafe(original.split("GRANT SELECT")[0]);
  await sql.unsafe(migration);
  await sql`INSERT INTO public.garages VALUES (${garageM4}, 'garage-m4', NULL, true), (${garageM1}, 'garage-m1', NULL, true)`;
}, 20000);

beforeEach(async () => {
  await sql`TRUNCATE public.bridge_release_runs`;
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (started) command(["pg_ctl", "-D", join(directory, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
});

test("garage-m4 error then running v1.5.0 clears its error and permits promotion after 24 hours", async () => {
  await sql`SELECT public.record_bridge_run(${garageM4}, 'v1.4.3', 'SHA256SUMS: HTTP 504', 'v1.5.0')`;
  const [failed] = await sql`SELECT update_errors FROM public.bridge_release_runs WHERE version = 'v1.5.0'`;
  expect(failed.update_errors).toBe(1);
  await sql`SELECT public.record_bridge_run(${garageM4}, 'v1.5.0', NULL, NULL)`;
  const [recovered] = await sql`SELECT *, first_seen_at::text AS first_seen_at FROM public.bridge_release_runs WHERE version = 'v1.5.0'`;
  expect(recovered.error_garages).toEqual([]);
  expect(recovered.update_errors).toBe(0);
  expect(recovered.garages_seen).toEqual(["garage-m4"]);
  expect(recovered.last_error).toBe("SHA256SUMS: HTTP 504");
  const first = Date.parse(recovered.first_seen_at);
  expect(Number.isFinite(first)).toBe(true);
  await sql`SELECT public.record_bridge_run(${garageM4}, 'v1.5.0', NULL, NULL)`;
  const [repeat] = await sql`SELECT first_seen_at::text AS first_seen_at, garages_seen, update_errors FROM public.bridge_release_runs WHERE version = 'v1.5.0'`;
  expect(repeat.first_seen_at).toBe(recovered.first_seen_at);
  expect(repeat.garages_seen).toEqual(["garage-m4"]);
  expect(pickStable(setting, [recovered], first + 24 * 3600000 - 1)).toBeNull();
  expect(pickStable(setting, [recovered], first + 24 * 3600000)).toBe("v1.5.0");
});

test("garage-m1 error still blocks v1.5.0 when only garage-m4 recovers", async () => {
  for (const garage of [garageM4, garageM1]) {
    await sql`SELECT public.record_bridge_run(${garage}, 'v1.4.3', 'HTTP 504', 'v1.5.0')`;
  }
  await sql`SELECT public.record_bridge_run(${garageM4}, 'v1.5.0', NULL, NULL)`;
  const [run] = await sql`SELECT *, first_seen_at::text AS first_seen_at FROM public.bridge_release_runs WHERE version = 'v1.5.0'`;
  expect(run.error_garages).toEqual(["garage-m1"]);
  expect(run.update_errors).toBe(1);
  expect(pickStable(setting, [run], Date.parse(run.first_seen_at) + 48 * 3600000)).toBeNull();
});

test("backfill removes only errors already in garages_seen and preserves v1.5.0 first-seen/history", async () => {
  await sql`INSERT INTO public.bridge_release_runs (version, first_seen_at, garages_seen, error_garages, update_errors, last_error)
    VALUES ('v1.5.0', '2026-11-08 15:15:05.199623+00', ARRAY['garage-m4'], ARRAY['garage-m4'], 1, 'HTTP 504'),
           ('v1.5.1', '2026-11-08 15:15:05.199623+00', ARRAY['garage-m4'], ARRAY['garage-m4', 'garage-m1'], 2, 'unresolved')`;
  const before = await sql`SELECT version, first_seen_at::text AS first_seen_at, last_seen_at::text AS last_seen_at, garages_seen, last_error FROM public.bridge_release_runs ORDER BY version`;
  await sql.unsafe(migration);
  const after = await sql`SELECT version, first_seen_at::text AS first_seen_at, last_seen_at::text AS last_seen_at, garages_seen, last_error FROM public.bridge_release_runs ORDER BY version`;
  expect(after).toEqual(before);
  const runs = await sql`SELECT version, error_garages, update_errors FROM public.bridge_release_runs ORDER BY version`;
  expect(runs[0].error_garages).toEqual([]);
  expect(runs[0].update_errors).toBe(0);
  expect(runs[1].error_garages).toEqual(["garage-m1"]);
  expect(runs[1].update_errors).toBe(1);
});

test("recording retains admin/canary guard and SECURITY DEFINER public search_path", async () => {
  const owner = "00000000-0000-0000-0000-000000000099";
  await sql`UPDATE public.garages SET canary = false, operator_id = ${owner} WHERE id = ${garageM1}`;
  await sql`SELECT public.record_bridge_run(${garageM1}, 'v1.5.0', 'HTTP 504', 'v1.5.1')`;
  expect((await sql`SELECT count(*)::integer AS count FROM public.bridge_release_runs`)[0].count).toBe(0);
  await sql`INSERT INTO public.user_roles VALUES (${owner}, 'admin')`;
  await sql`SELECT public.record_bridge_run(${garageM1}, 'v1.5.0', NULL, NULL)`;
  expect((await sql`SELECT garages_seen FROM public.bridge_release_runs WHERE version = 'v1.5.0'`)[0].garages_seen).toEqual(["garage-m1"]);
  const [fn] = await sql`SELECT prosecdef, proconfig FROM pg_proc WHERE oid = 'public.record_bridge_run(uuid,text,text,text)'::regprocedure`;
  expect(fn.prosecdef).toBe(true);
  expect(fn.proconfig).toEqual(["search_path=public"]);
});