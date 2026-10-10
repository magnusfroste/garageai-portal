// Read-only business aggregates for the gateway Operations Center. Auth: x-gateway-key (like gateway-targets).
// Returns counts and sums only: never e-mails, names, keys, Stripe ids or other personal data.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatewayJson, isGatewayAuthorized } from "../_shared/gatewayAuth.ts";
import { getProxyBaseUrl } from "../_shared/proxyConfig.ts";

const H = 3600_000;
const BUDGET_MS = 1500;
const round = (n: number) => Math.round(n * 100) / 100;
const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function timed<T>(p: Promise<T>, fallback: T): Promise<T> {
  let t: number | undefined;
  try { return await Promise.race([p, new Promise<T>((r) => { t = setTimeout(() => r(fallback), BUDGET_MS); })]); }
  catch { return fallback; } finally { clearTimeout(t); }
}
const withSignal = (ms = BUDGET_MS) => AbortSignal.timeout(ms);

/** api_key → spend in [start,end] from LiteLLM's pre-aggregated report (day granularity). */
async function keySpend(base: string, key: string, days: number): Promise<Map<string, number> | null> {
  const end = new Date(), start = new Date(Date.now() - days * 24 * H);
  const res = await fetch(`${base}/global/spend/report?start_date=${fmt(start)}&end_date=${fmt(end)}&group_by=api_key`, { headers: { Authorization: `Bearer ${key}` }, signal: withSignal() });
  if (!res.ok) return null;
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.results || data.data || []);
  const out = new Map<string, number>();
  for (const r of rows) {
    const list = Array.isArray(r.breakdown?.api_keys || r.api_keys) && (r.breakdown?.api_keys || r.api_keys).length ? (r.breakdown?.api_keys || r.api_keys) : [r];
    for (const k of list) {
      const token = k.api_key || k.key || k.token; if (!token) continue;
      const reqs = Number(k.api_requests ?? k.metrics?.api_requests ?? 0), spend = Number(k.spend ?? k.metrics?.spend ?? 0);
      if (reqs > 0 || spend > 0) out.set(token, (out.get(token) ?? 0) + spend);
    }
  }
  return out;
}

async function userSpend(base: string, key: string, litellmId: string): Promise<number | null> {
  const res = await fetch(`${base}/user/info?user_id=${encodeURIComponent(litellmId)}`, { headers: { Authorization: `Bearer ${key}` }, signal: withSignal() });
  if (!res.ok) return null;
  const d = await res.json();
  return Number((d.user_info || d).spend ?? 0);
}

async function pendingCheckouts(): Promise<number | null> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY"); if (!sk) return null;
  const before = Math.floor((Date.now() - H) / 1000), after = Math.floor((Date.now() - 24 * H) / 1000);
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?status=open&limit=100&created[lt]=${before}&created[gte]=${after}`, { headers: { Authorization: `Bearer ${sk}` }, signal: withSignal() });
  if (!res.ok) return null;
  const d = await res.json() as { data: Array<{ metadata?: Record<string, string> }> };
  return d.data.filter((s) => s.metadata?.app === "garageai").length;
}

async function operators(admin: SupabaseClient) {
  const [{ data: garages }, { data: stats }] = await Promise.all([
    admin.from("garages").select("id, name, terms_accepted_at"),
    admin.from("garage_model_stats_hourly").select("garage_id, garage_name, hour, spend_usd"),
  ]);
  const now = Date.now();
  const by = new Map<string, { garage: string; earned_24h_usd: number; earned_7d_usd: number; earned_total_usd: number; terms_accepted: boolean }>();
  const names = new Map<string, string>();
  for (const g of (garages || []) as Array<{ id: string; name: string; terms_accepted_at: string | null }>) {
    names.set(g.id, g.name);
    by.set(g.name, { garage: g.name, earned_24h_usd: 0, earned_7d_usd: 0, earned_total_usd: 0, terms_accepted: !!g.terms_accepted_at });
  }
  for (const s of (stats || []) as Array<{ garage_id: string; garage_name: string | null; hour: string; spend_usd: number }>) {
    const name = names.get(s.garage_id) ?? s.garage_name ?? s.garage_id;
    if (!by.has(name)) by.set(name, { garage: name, earned_24h_usd: 0, earned_7d_usd: 0, earned_total_usd: 0, terms_accepted: false });
    const row = by.get(name)!, v = Number(s.spend_usd) || 0, age = now - new Date(s.hour).getTime();
    row.earned_total_usd += v; if (age <= 7 * 24 * H) row.earned_7d_usd += v; if (age <= 24 * H) row.earned_24h_usd += v;
  }
  return [...by.values()].map((r) => ({ ...r, earned_24h_usd: round(r.earned_24h_usd), earned_7d_usd: round(r.earned_7d_usd), earned_total_usd: round(r.earned_total_usd) })).sort((a, b) => b.earned_7d_usd - a.earned_7d_usd);
}

async function onboarding(admin: SupabaseClient) {
  const { data: garages } = await admin.from("garages").select("id, name, created_at").is("last_registered_at", null).neq("connection_type", "endpoint").order("created_at", { ascending: false });
  const list = (garages || []) as Array<{ id: string; name: string; created_at: string }>;
  const latest = new Map<string, { step: string; status: string }>();
  if (list.length) {
    const { data: ev } = await admin.from("onboarding_events").select("garage_id, step, status, created_at").in("garage_id", list.map((g) => g.id)).order("created_at", { ascending: false }).limit(list.length * 30);
    for (const e of (ev || []) as Array<{ garage_id: string; step: string; status: string }>) if (!latest.has(e.garage_id)) latest.set(e.garage_id, e);
  }
  return { count: list.length, garages: list.map((g) => ({ garage: g.name, created_at: g.created_at, last_step: latest.get(g.id)?.step ?? null, last_status: latest.get(g.id)?.status ?? null })) };
}

async function adminActivity(admin: SupabaseClient) {
  const { data } = await admin.from("garage_price_history").select("effective_from, garage_name, changed_by").not("changed_by", "is", null).order("effective_from", { ascending: false }).limit(20);
  return ((data || []) as Array<{ effective_from: string; garage_name: string | null }>).map((r) => ({ at: r.effective_from, action: "price changed", target: r.garage_name }));
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return gatewayJson({ error: "Method not allowed" }, 405);
  if (!(await isGatewayAuthorized(req))) return gatewayJson({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const master = Deno.env.get("LITELLM_MASTER_KEY")!;
    const now = Date.now(), d1 = new Date(now - 24 * H).toISOString(), d7 = new Date(now - 7 * 24 * H).toISOString();
    const base = await timed(getProxyBaseUrl(admin), null as string | null);

    const [profilesRes, keysRes, chatsRes, txRes, spend1, spend7, pending, ops, onb, activity] = await Promise.all([
      admin.from("profiles").select("id, created_at, litellm_user_id, starting_credit_usd, purchased_credits_usd"),
      admin.from("api_keys").select("user_id, key_value, litellm_token"),
      admin.from("chat_conversations").select("user_id, updated_at").gte("updated_at", d7),
      admin.from("credit_transactions").select("amount_usd, created_at").order("created_at", { ascending: false }),
      base ? timed(keySpend(base, master, 1), null) : Promise.resolve(null),
      base ? timed(keySpend(base, master, 7), null) : Promise.resolve(null),
      timed(pendingCheckouts(), null),
      operators(admin), onboarding(admin), adminActivity(admin),
    ]);
    const profiles = (profilesRes.data || []) as Array<{ id: string; created_at: string; litellm_user_id: string | null; starting_credit_usd: number; purchased_credits_usd: number }>;
    const keyOwner = new Map<string, string>();
    for (const k of (keysRes.data || []) as Array<{ user_id: string; key_value: string; litellm_token: string | null }>) { if (k.litellm_token) keyOwner.set(k.litellm_token, k.user_id); keyOwner.set(k.key_value, k.user_id); }
    const activeSet = (spend: Map<string, number> | null, since: string) => {
      const s = new Set<string>();
      for (const c of (chatsRes.data || []) as Array<{ user_id: string; updated_at: string }>) if (c.updated_at >= since) s.add(c.user_id);
      for (const tok of spend?.keys() ?? []) { const u = keyOwner.get(tok); if (u) s.add(u); }
      return s;
    };
    const active1 = activeSet(spend1, d1), active7 = activeSet(spend7, d7);

    const spends = base ? await timed(Promise.all(profiles.map(async (p) => [p.id, p.litellm_user_id ? await userSpend(base, master, p.litellm_user_id).catch(() => null) : 0] as const)), null) : null;
    const spendBy = spends ? new Map(spends) : null;
    let outstanding: number | null = spendBy ? 0 : null, low = spendBy ? 0 : null;
    if (spendBy) for (const p of profiles) {
      const used = spendBy.get(p.id);
      if (used == null) continue;
      const balance = Number(p.starting_credit_usd || 0) + Number(p.purchased_credits_usd || 0) - used;
      outstanding! += Math.max(0, balance);
      if (balance < 1 && active7.has(p.id)) low!++;
    }

    const tx = (txRes.data || []) as Array<{ amount_usd: number; created_at: string }>;
    const sum = (since: string) => { const r = tx.filter((t) => t.created_at >= since); return { count: r.length, amount_usd: round(r.reduce((a, t) => a + Number(t.amount_usd || 0), 0)) }; };

    return gatewayJson({
      generated_at: new Date().toISOString(),
      buyers: {
        total: profiles.length,
        new_24h: profiles.filter((p) => p.created_at >= d1).length,
        new_7d: profiles.filter((p) => p.created_at >= d7).length,
        active_24h: spend1 ? active1.size : null,
        low_credit: low,
      },
      credits: { topups_24h: sum(d1), topups_7d: sum(d7), outstanding_balance_usd: outstanding == null ? null : round(outstanding) },
      stripe: { last_webhook_at: null, last_topup_at: tx[0]?.created_at ?? null, failed_webhooks_24h: null, pending_checkouts: pending },
      operators: ops,
      onboarding: onb,
      admin_activity: activity,
    });
  } catch (e) {
    console.error("[ops-summary] error", e instanceof Error ? e.message : "unknown");
    return gatewayJson({ error: "Internal error" }, 500);
  }
});
