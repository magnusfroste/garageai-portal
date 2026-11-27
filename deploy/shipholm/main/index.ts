// The functions' front door on a host of our own (deploy/shipholm): what Supabase's gateway did.
// A request for /<function>/… is handed to that function in a worker of its own.
// No JWT is checked here, as on Lovable Cloud today (measured 2026-11-27: robots, sitemap and
// list-models answer without one, and a refusal comes from the function, not the gateway):
// every function decides for itself who may call it. Not a function itself: "main" is refused.

// What the functions must not see: the database owner's address and the other parts' settings.
const HIDDEN = /^(DATABASE_URL|PORTAL_JWT_SECRET|GOTRUE_.*|PGRST_.*|API_EXTERNAL_URL)$/;
const ENV = Object.entries(Deno.env.toObject()).filter(([name]) => !HIDDEN.test(name));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function exists(name: string): Promise<boolean> {
  try {
    return (await Deno.stat(`/app/functions/${name}/index.ts`)).isFile;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const name = new URL(req.url).pathname.split("/")[1] ?? "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || name === "main" || !(await exists(name))) {
    return json(404, { code: "NOT_FOUND", message: "Requested function was not found" });
  }
  try {
    // deno-lint-ignore no-explicit-any
    const worker = await (globalThis as any).EdgeRuntime.userWorkers.create({
      servicePath: `/app/functions/${name}`,
      memoryLimitMb: 256,
      workerTimeoutMs: 400_000,       // register-node runs the acceptance test: up to 190 s
      cpuTimeSoftLimitMs: 10_000,
      cpuTimeHardLimitMs: 20_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: ENV,
      forceCreate: false,
      netAccessDisabled: false,
    });
    return await worker.fetch(req);
  } catch (error) {
    console.error(`function ${name}:`, error);
    return json(500, { code: "WORKER_ERROR", message: "The function could not be started" });
  }
});
