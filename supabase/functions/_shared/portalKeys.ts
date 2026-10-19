// One path for every portal-created gateway key (generate, default, chat, rotate).
// The full key value is returned once to the caller; the portal stores only
// its last 4 characters, the internal alias and the hashed token revoke needs.
import { getProxyBaseUrl } from "./proxyConfig.ts";
import { internalAlias } from "./internalTraffic.ts";
import { ensureLiteLLMUser } from "./litellmUsers.ts";
import { litellmKeyAlias } from "./keyAlias.ts";

export type KeyKind = "user" | "default" | "chat";

/** Placeholder kept in the legacy NOT NULL UNIQUE column; never the real key. */
export const HIDDEN_PREFIX = "hidden:";

export function storedKeyValue(key: string, showOnce: boolean, id = crypto.randomUUID()): string {
  return showOnce ? `${HIDDEN_PREFIX}${id}` : key;
}

export const keyLast4 = (key: string) => key.slice(-4);

/** "Chat · Chrome on Mac" — device label is sanitised and capped. */
export function chatKeyName(deviceLabel: unknown): string {
  const label = typeof deviceLabel === "string" ? deviceLabel.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40) : "";
  return `Chat · ${label || "this browser"}`;
}

export interface CreateKeyInput {
  userId: string;
  name: string;
  kind: KeyKind;
  showOnce: boolean;
  deviceLabel?: string | null;
  models?: string[];
}

export interface CreatedKey { id: string; key: string; name: string; last4: string; kind: KeyKind }

async function generate(base: string, master: string, body: Record<string, unknown>) {
  const res = await fetch(`${base}/key/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${master}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.error === "string" ? data.error : JSON.stringify(data?.error ?? data?.detail ?? "").slice(0, 300);
    const err = new Error(`LiteLLM key/generate ${res.status}: ${detail}`) as Error & { aliasTaken?: boolean };
    err.aliasTaken = /alias/i.test(detail) && /exist/i.test(detail);
    throw err;
  }
  return data as { key: string; token?: string };
}

// deno-lint-ignore no-explicit-any
export async function createPortalKey(admin: any, input: CreateKeyInput): Promise<CreatedKey> {
  const master = Deno.env.get("LITELLM_MASTER_KEY");
  if (!master) throw new Error("LITELLM_MASTER_KEY not configured");
  const { data: profile, error } = await admin.from("profiles")
    .select("id, email, litellm_user_id, starting_credit_usd, purchased_credits_usd").eq("id", input.userId).single();
  if (error || !profile) throw new Error("Profile not found");
  const base = await getProxyBaseUrl(admin);
  const ensured = await ensureLiteLLMUser(admin, profile);
  const { data: rpm } = await admin.from("admin_settings").select("value").eq("key", "key_rpm_limit").maybeSingle();
  const internal = internalAlias(input.name);
  let alias = litellmKeyAlias(input.userId, input.name);
  // No per-key max_budget: the user's budget is the single cap.
  const body = () => ({
    key_alias: alias, user_id: ensured.userId, rpm_limit: Math.max(1, Number(rpm?.value ?? 60)),
    metadata: { internal, kind: input.kind },
    ...(input.models?.length ? { models: input.models } : {}),
  });
  let created;
  try { created = await generate(base, master, body()); }
  catch (e) {
    if (!(e as { aliasTaken?: boolean }).aliasTaken) throw e;
    alias = litellmKeyAlias(input.userId, input.name);
    created = await generate(base, master, body());
  }
  const id = crypto.randomUUID();
  const { error: dbError } = await admin.from("api_keys").insert({
    id, user_id: input.userId, name: input.name, internal, kind: input.kind,
    device_label: input.deviceLabel ?? null,
    key_value: storedKeyValue(created.key, input.showOnce, id),
    key_last4: keyLast4(created.key),
    litellm_token: created.token || null, litellm_alias: alias,
    expires_at: null, trial_credits_usd: Number(profile.starting_credit_usd || 0), used_credits_usd: 0, is_active: true,
  });
  if (dbError) {
    console.error("api_keys insert failed; deleting gateway key", dbError.message);
    await fetch(`${base}/key/delete`, { method: "POST", headers: { Authorization: `Bearer ${master}`, "Content-Type": "application/json" }, body: JSON.stringify({ keys: [created.token || created.key] }) }).catch(() => {});
    throw new Error("Failed to save API key");
  }
  return { id, key: created.key, name: input.name, last4: keyLast4(created.key), kind: input.kind };
}
