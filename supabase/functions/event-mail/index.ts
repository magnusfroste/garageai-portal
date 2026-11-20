import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { MAIL_DEFAULTS, MAIL_KEYS, MAIL_RUN_LIMIT, mailToken, verifyMailToken, renderMail, type MailCandidate, type MailTemplate, type MailSettings } from "../_shared/eventMail.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
const SettingsSchema = z.object({ mode: z.enum(["off", "test", "on"]), test_delay_minutes: z.number().int().min(1).max(1440), max_per_week: z.number().int().min(0).max(100), max_total: z.number().int().min(0).max(1000), from_email: z.email().max(254), from_name: z.string().trim().min(1).max(100) });
const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("preview"), template_key: z.enum(MAIL_KEYS), language: z.enum(["en", "sv"]) }),
  z.object({ action: z.literal("send_test"), template_key: z.enum(MAIL_KEYS), language: z.enum(["en", "sv"]) }),
  z.object({ action: z.literal("save_settings"), settings: SettingsSchema, confirm_on: z.boolean().optional() }),
  z.object({ action: z.enum(["unsubscribe", "undo", "status"]), token: z.string().min(1).max(150) }),
  z.object({ action: z.literal("capabilities") }),
]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);
  try {
    const url = new URL(req.url);
    let input: unknown;
    if (req.method === "GET") input = { action: "status", token: url.searchParams.get("t") ?? "" };
    else if (url.searchParams.has("t") && req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) input = { action: "unsubscribe", token: url.searchParams.get("t") };
    else { try { input = await req.json(); } catch { return json({ error: "Invalid request" }, 400); } }
    const parsed = BodySchema.safeParse(input);
    if (!parsed.success) return json({ error: "Invalid mail request" }, 400);
    const body = parsed.data;
    const dbUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!dbUrl || !serviceKey) return json({ error: "Mail configuration unavailable" }, 503);
    const admin = createClient(dbUrl, serviceKey);
    async function rpc(name: string, args: Record<string, unknown> = {}) { const { data, error } = await admin.rpc(name, args); if (error) throw new Error("Mail database operation failed"); return data; }

    if (body.action === "unsubscribe" || body.action === "undo" || body.action === "status") {
      const secret = Deno.env.get("MAIL_LINK_SECRET");
      if (!secret) return json({ error: "Mail links are not configured yet" }, 503);
      const userId = await verifyMailToken(body.token, secret);
      if (!userId) return json({ error: "This mail link is invalid" }, 400);
      if (body.action !== "status") {
        const { error } = await admin.from("profiles").update({ mail_opt_out_at: body.action === "undo" ? null : new Date().toISOString() }).eq("id", userId);
        if (error) throw new Error("Mail preference could not be saved");
      }
      const { data, error } = await admin.from("profiles").select("mail_opt_out_at,mail_language").eq("id", userId).maybeSingle();
      if (error || !data) return json({ error: "This mail link is invalid" }, 400);
      return json({ opted_out: data.mail_opt_out_at !== null, language: data.mail_language });
    }

    let adminUser: { id: string; email?: string } | null = null;
    if (body.action === "run") {
      const denied = authenticateCronRequest(req);
      if (denied) return json({ error: "Unauthorized" }, denied.status);
    } else {
      const token = /^Bearer ([^\s,]+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
      if (!token) return json({ error: "Authentication required" }, 401);
      const { data: user, error } = await admin.auth.getUser(token);
      if (error || !user.user) return json({ error: "Authentication required" }, 401);
      const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", user.user.id).eq("role", "admin");
      if (roleError || !roles?.length) return json({ error: "Admin required" }, 403);
      adminUser = { id: user.user.id, email: user.user.email };
    }

    if (body.action === "capabilities") return json({ mail_key: !!Deno.env.get("BREVO_API_KEY"), link_secret: !!Deno.env.get("MAIL_LINK_SECRET") });
    const { data: setting, error: settingError } = await admin.from("admin_settings").select("value").eq("key", "event_mail").maybeSingle();
    if (settingError) throw new Error("Mail settings unavailable");
    const settingsParsed = SettingsSchema.safeParse(setting?.value ?? MAIL_DEFAULTS);
    if (!settingsParsed.success) return json({ error: "Invalid mail settings" }, 503);
    const settings: MailSettings = settingsParsed.data;
    if (body.action === "save_settings") {
      if (body.settings.mode === "on" && settings.mode !== "on" && !body.confirm_on) return json({ error: "Confirm before enabling mail", eligible: await rpc("event_mail_eligible_counts") }, 409);
      const { error } = await admin.from("admin_settings").upsert({ key: "event_mail", value: body.settings, updated_at: new Date().toISOString() });
      if (error) throw new Error("Mail settings could not be saved");
      return json({ ok: true });
    }
    if (body.action === "run") {
      await rpc("event_mail_prune");
      if (settings.mode === "off") return json({ ok: true, mode: "off", evaluated: 0, sent: 0 });
    }

    const { data: templates, error: templatesError } = await admin.from("mail_templates").select("*");
    if (templatesError) throw new Error("Mail templates unavailable");
    const templateByKey = new Map((templates ?? []).map((t: MailTemplate) => [t.key, t]));
    let candidates: MailCandidate[] = [];
    if (body.action === "run") candidates = await rpc("event_mail_candidates") ?? [];
    else if (body.action === "preview" || body.action === "send_test") {
      if (!adminUser?.email) return json({ error: "Your account has no mail address" }, 400);
      const { data: keys } = await admin.from("api_keys").select("key_last4").eq("user_id", adminUser.id).eq("internal", false).order("created_at").limit(1);
      const { data: garages } = await admin.from("garages").select("name,display_name,last_heartbeat_at").eq("operator_id", adminUser.id).order("created_at").limit(1);
      const garage = garages?.[0];
      candidates = [{ user_id: adminUser.id, email: adminUser.email, template_key: body.template_key, event_ref: "manual-test", key_hint: keys?.[0]?.key_last4 ?? "", garage_name: garage?.display_name || garage?.name || "", days_offline: garage?.last_heartbeat_at ? Math.max(0, Math.floor((Date.now() - Date.parse(garage.last_heartbeat_at)) / 86400_000)) : 0 }];
    }
    const values = (c: MailCandidate) => ({ key_hint: c.key_hint, garage_name: c.garage_name, days_offline: String(c.days_offline) });
    const link = async (c: MailCandidate) => `https://app.garageai.eu/mail/unsubscribe?t=${encodeURIComponent(await mailToken(c.user_id, Deno.env.get("MAIL_LINK_SECRET") ?? ""))}`;
    if (body.action === "preview") {
      const candidate = candidates[0], template = templateByKey.get(body.template_key);
      if (!candidate || !template) return json({ error: "Template unavailable" }, 404);
      const previewUrl = Deno.env.get("MAIL_LINK_SECRET") ? await link(candidate) : "https://app.garageai.eu/mail/unsubscribe";
      return json(renderMail(template, body.language, values(candidate), previewUrl));
    }
    const owner = crypto.randomUUID();
    if (!await rpc("event_mail_lock", { _owner: owner })) return json({ ok: true, busy: true, sent: 0 });
    let sent = 0, attempted = 0;
    try {
      for (const candidate of candidates) {
        if (attempted >= MAIL_RUN_LIMIT) break;
        const template = templateByKey.get(candidate.template_key);
        if (!template || (body.action === "run" && !template.enabled)) continue;
        const claim = await rpc("event_mail_claim", { _user_id: candidate.user_id, _template: candidate.template_key, _ref: candidate.event_ref, _manual: body.action === "send_test" });
        if (!claim || claim.status !== "ready") continue;
        attempted++;
        const finish = (success: boolean, provider: string | null, error: string | null, definite = true) => rpc("event_mail_finish", { _log_id: claim.log_id, _sent: success, _provider_id: provider, _error: error, _definite_failure: definite });
        const apiKey = Deno.env.get("BREVO_API_KEY"), secret = Deno.env.get("MAIL_LINK_SECRET");
        if (!apiKey) { await finish(false, null, "no mail key"); continue; }
        if (!secret) { await finish(false, null, "no mail link secret"); continue; }
        // Recheck opt-out and mode immediately before external delivery.
        const [{ data: profile }, { data: current }] = await Promise.all([admin.from("profiles").select("mail_opt_out_at").eq("id", candidate.user_id).single(), admin.from("admin_settings").select("value").eq("key", "event_mail").single()]);
        if (!profile || profile.mail_opt_out_at || !current || (body.action === "run" && (current.value as { mode?: string }).mode !== settings.mode)) { await finish(false, null, "mail preferences changed"); continue; }
        const unsubscribeUrl = await link(candidate);
        const language = body.action === "send_test" ? body.language : claim.language === "sv" ? "sv" : "en";
        const rendered = renderMail(template, language, values(candidate), unsubscribeUrl);
        try {
          const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ sender: { email: settings.from_email, name: settings.from_name }, to: [{ email: candidate.email }], ...rendered, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }) });
          if (!response.ok) { await response.text(); await finish(false, null, `Brevo HTTP ${response.status}`); continue; }
          const result = await response.json().catch(() => ({}));
          await finish(true, typeof result.messageId === "string" ? result.messageId : null, null);
          sent++;
        } catch { await finish(false, null, "delivery outcome unknown", false); }
      }
    } finally { await rpc("event_mail_lock", { _owner: owner, _release: true }); }
    return json({ ok: true, mode: settings.mode, attempted, sent });
  } catch {
    // Never log tokens, recipients, provider bodies or rendered mail.
    console.error("[event-mail] operation failed");
    return json({ error: "Mail operation failed" }, 500);
  }
});