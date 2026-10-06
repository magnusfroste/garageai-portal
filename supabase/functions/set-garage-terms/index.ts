// Records operator acceptance of the prompt-confidentiality terms for an existing garage (owner or admin).
import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { termsAccepted, termsFields } from "../_shared/garageTerms.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    const { admin, userId, isAdmin } = caller;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return json({ error: "invalid name" }, 400);
    if (!termsAccepted(body)) return json({ error: "terms must be accepted" }, 400);
    const { data: g } = await admin.from("garages").select("id, operator_id").eq("name", name).maybeSingle();
    if (!g) return json({ error: "Garage not found" }, 404);
    if (!isAdmin && g.operator_id !== userId) return json({ error: "Forbidden" }, 403);
    const fields = termsFields();
    const { error } = await admin.from("garages").update(fields).eq("id", g.id);
    if (error) throw error;
    return json({ ok: true, ...fields });
  } catch (e) {
    console.error("[set-garage-terms] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
