// Issues garage register credentials. Tunnel assignment is owned by tunnel-assign.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { termsFields } from "./garageTerms.ts";
import { MAX_GARAGES_PER_OPERATOR, isSameMachineRelink, ownershipError } from "./garageCredentialRules.ts";

export class CredentialError extends Error { constructor(public status: number, message: string) { super(message); } }

export interface IssueOptions {
  userId: string;
  isAdmin: boolean;
  name: string;
  apiHost?: string;
  adminPanel: boolean;
  operatorId?: string;
  acceptTerms: boolean;
  /** Machine asking for credentials (Bridge link); same machine re-linking its garage is not rate-limited. */
  machineId?: string | null;
}

export interface IssuedCredentials { garage: Record<string, any>; register_token: string; register_url: string; reused: boolean }

const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256Hex = async (s: string) => toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));

export async function loadGarageByName(admin: SupabaseClient, name: string) {
  const { data, error } = await admin.from("garages").select("*").eq("name", name).maybeSingle();
  if (error) throw error;
  return data as Record<string, any> | null;
}

export async function countOwnedGarages(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin.from("garages").select("id", { count: "exact", head: true }).eq("operator_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function issueGarageCredentials(admin: SupabaseClient, o: IssueOptions): Promise<IssuedCredentials> {
  const existing = await loadGarageByName(admin, o.name);
  const relink = isSameMachineRelink(existing as any, o.machineId);

  if (!o.isAdmin) {
    let owned = 0;
    if (!existing) owned = await countOwnedGarages(admin, o.userId);
    let calls = 0;
    if (!relink && !(existing && existing.operator_id !== o.userId) && !existing?.disabled && owned < MAX_GARAGES_PER_OPERATOR) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count, error } = await admin.from("garage_tokens").select("id, garages!inner(operator_id)", { count: "exact", head: true })
        .eq("garages.operator_id", o.userId).eq("relink", false).gte("created_at", since);
      if (error) throw error;
      calls = count ?? 0;
    }
    const err = ownershipError(existing as any, o.userId, false, owned, calls, relink);
    if (err) throw new CredentialError(err.status, err.error);
  }

  let garage: Record<string, any>;
  if (existing) {
    if (existing.connection_type === "endpoint") throw new CredentialError(400, "provider endpoints cannot receive garage credentials");
    const patch: Record<string, unknown> = { transport: "tunnel", ...(o.acceptTerms ? termsFields() : {}) };
    if (o.apiHost !== undefined) patch.api_host = o.apiHost;
    if (o.operatorId !== undefined) patch.operator_id = o.operatorId;
    if (Object.keys(patch).length) {
      const { data, error } = await admin.from("garages").update(patch).eq("id", existing.id).select("*").single();
      if (error) throw error;
      garage = data;
    } else garage = existing;
  } else {
    const { data, error } = await admin.from("garages")
      .insert({ name: o.name, api_host: o.apiHost ?? null, operator_id: o.operatorId ?? null, status: "pending", transport: "tunnel", ...termsFields() })
      .select("*").single();
    if (error) throw error;
    garage = data;
  }

  if (!o.adminPanel && garage.operator_id !== o.userId) throw new Error("invariant: wizard-created garage must be owned by the caller");

  const registerToken = "grg_" + toHex(crypto.getRandomValues(new Uint8Array(32)));
  const { error: revErr } = await admin.from("garage_tokens").update({ revoked_at: new Date().toISOString() }).eq("garage_id", garage.id).is("revoked_at", null);
  if (revErr) throw revErr;
  const { error: insErr } = await admin.from("garage_tokens").insert({ garage_id: garage.id, token_hash: await sha256Hex(registerToken), relink });
  if (insErr) throw insErr;

  return {
    garage, register_token: registerToken,
    register_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/register-node`,
    reused: !!existing,
  };
}
