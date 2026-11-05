// Earnings classification: only requests other users paid for with purchased credit earn.
// The buyer is resolved server-side from api_keys (token / alias), never from a key name.
import { fingerprint } from "./internalTraffic.ts";

export type EarningsBucket = "own" | "trial" | "payable";

export interface BuyerDirectory {
  /** key value, hashed gateway token or their fingerprints → owning user id */
  byKey: Map<string, string>;
  /** internal gateway alias → owning user id */
  byAlias: Map<string, string>;
  /** user id → first completed Stripe purchase (ms) */
  firstPurchase: Map<string, number>;
}

/**
 * own: the buyer is the garage's operator; payable: a different buyer whose request started at or
 * after their first completed purchase; trial: everything else (unknown buyer, internal traffic,
 * or a buyer who had not bought credit yet). Time-based, so re-ingesting an old hour never
 * reclassifies requests made before a later purchase.
 */
export function classifyRequest(input: { buyer: string | null; operator: string | null; startMs: number; firstPurchaseMs?: number; internal?: boolean }): EarningsBucket {
  const { buyer, operator, startMs, firstPurchaseMs, internal } = input;
  if (buyer && operator && buyer === operator) return "own";
  if (!buyer || internal) return "trial";
  return firstPurchaseMs !== undefined && startMs >= firstPurchaseMs ? "payable" : "trial";
}

const meta = (row: Record<string, unknown>): Record<string, unknown> => {
  const m = row.metadata;
  if (typeof m === "string") { try { return JSON.parse(m) ?? {}; } catch { return {}; } }
  return m && typeof m === "object" ? m as Record<string, unknown> : {};
};

/** Buyer user of a spend-log row, via the key token first and the internal alias second. */
export function buyerOf(row: Record<string, unknown>, dir: BuyerDirectory): string | null {
  const key = typeof row.api_key === "string" ? row.api_key : "";
  if (key && dir.byKey.has(key)) return dir.byKey.get(key)!;
  const m = meta(row);
  const alias = row.key_alias ?? m.user_api_key_alias ?? m.key_alias;
  if (typeof alias === "string" && alias && dir.byAlias.has(alias)) return dir.byAlias.get(alias)!;
  return null;
}

// deno-lint-ignore no-explicit-any
export async function loadBuyerDirectory(admin: any): Promise<BuyerDirectory> {
  const [{ data: keys, error: kErr }, { data: tx, error: tErr }] = await Promise.all([
    admin.from("api_keys").select("user_id,key_value,litellm_token,litellm_alias"),
    admin.from("credit_transactions").select("user_id,created_at,credits_added").not("stripe_session_id", "is", null).gt("credits_added", 0),
  ]);
  if (kErr || tErr) throw new Error("Cannot load buyer directory");
  const byKey = new Map<string, string>(), byAlias = new Map<string, string>(), firstPurchase = new Map<string, number>();
  for (const k of (keys ?? []) as Array<{ user_id: string; key_value: string | null; litellm_token: string | null; litellm_alias: string | null }>) {
    for (const v of [k.key_value, k.litellm_token]) if (v) { byKey.set(v, k.user_id); byKey.set(await fingerprint(v), k.user_id); }
    if (k.litellm_alias) byAlias.set(k.litellm_alias, k.user_id);
  }
  for (const t of (tx ?? []) as Array<{ user_id: string; created_at: string }>) {
    const ms = Date.parse(t.created_at);
    if (Number.isFinite(ms) && ms < (firstPurchase.get(t.user_id) ?? Infinity)) firstPurchase.set(t.user_id, ms);
  }
  return { byKey, byAlias, firstPurchase };
}
