// Admin-only: record or clear operator-terms acceptance on behalf of an endpoint provider, with an audit row.
import { corsHeaders, json, NAME_RE, getCaller } from "../_shared/garageAuth.ts";
import { parseProviderTermsInput } from "../_shared/providerTerms.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (caller instanceof Response) return caller;
    if (!caller.isAdmin) return json({ error: "Forbidden" }, 403);
    const { admin, userId } = caller;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return json({ error: "invalid name" }, 400);
    const input = parseProviderTermsInput(body);
    if (typeof input === "string") return json({ error: input }, 400);
    const { data: g } = await admin.from("garages").select("id, connection_type").eq("name", name).maybeSingle();
    if (!g || g.connection_type !== "endpoint") return json({ error: "Provider not found" }, 404);
    const fields = input.action === "record"
      ? { terms_accepted_at: input.acceptedAt, terms_version: input.version, terms_accepted_by: userId, terms_accepted_via: "admin", terms_note: input.note }
      : { terms_accepted_at: null, terms_version: null, terms_accepted_by: userId, terms_accepted_via: "admin", terms_note: input.note };
    const { error } = await admin.from("garages").update(fields).eq("id", g.id);
    if (error) throw error;
    const { error: auditError } = await admin.from("garage_terms_events").insert({
      garage_id: g.id, action: input.action, actor_id: userId, note: input.note,
      terms_version: input.action === "record" ? input.version : null, accepted_at: input.action === "record" ? input.acceptedAt : null,
    });
    if (auditError) console.error("[provider-terms] audit failed:", auditError.message);
    return json({ ok: true, ...fields });
  } catch (e) {
    console.error("[provider-terms] error:", (e as { message?: string })?.message ?? "unknown");
    return json({ error: (e as { message?: string })?.message || "Internal error" }, 500);
  }
});
