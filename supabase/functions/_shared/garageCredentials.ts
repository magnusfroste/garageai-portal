// Issues garage credentials (register token + optional NetBird setup key). Shared by create-garage and bridge-link-approve.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { termsFields } from "./garageTerms.ts";
import { getNetbirdApiUrl, netbirdHeaders, getGaragesGroupId, ensureGarageGroup } from "./netbirdConfig.ts";
import { MAX_GARAGES_PER_OPERATOR, decideSetupKey, isSameMachineRelink, ownershipError } from "./garageCredentialRules.ts";

export class CredentialError extends Error { constructor(public status: number, message: string) { super(message); } }

export interface IssueOptions {
  userId: string;
  isAdmin: boolean;
  name: string;
  apiHost?: string;
  adminPanel: boolean;
  operatorId?: string;
  /** Raw create_setup_key from the caller (undefined = default). */
  setupKeyRequested: unknown;
  acceptTerms: boolean;
  /** Machine asking for credentials (Bridge link); same machine re-linking its garage is not rate-limited. */
  machineId?: string | null;
}

export interface IssuedCredentials { garage: Record<string, any>; register_token: string; setup_key: string | null; register_url: string; management_url: string; reused: boolean }

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
    const patch: Record<string, unknown> = o.acceptTerms ? { ...termsFields() } : {};
    if (o.apiHost !== undefined) patch.api_host = o.apiHost;
    if (o.operatorId !== undefined) patch.operator_id = o.operatorId;
    if (Object.keys(patch).length) {
      const { data, error } = await admin.from("garages").update(patch).eq("id", existing.id).select("*").single();
      if (error) throw error;
      garage = data;
    } else garage = existing;
  } else {
    const { data, error } = await admin.from("garages")
      .insert({ name: o.name, api_host: o.apiHost ?? null, operator_id: o.operatorId ?? null, status: "pending", ...termsFields() })
      .select("*").single();
    if (error) throw error;
    garage = data;
  }

  if (!o.adminPanel && garage.operator_id !== o.userId) throw new Error("invariant: wizard-created garage must be owned by the caller");

  const createSetupKey = decideSetupKey(o.setupKeyRequested, o.isAdmin, !!garage.netbird_peer_id);

  const registerToken = "grg_" + toHex(crypto.getRandomValues(new Uint8Array(32)));
  const { error: revErr } = await admin.from("garage_tokens").update({ revoked_at: new Date().toISOString() }).eq("garage_id", garage.id).is("revoked_at", null);
  if (revErr) throw revErr;
  const { error: insErr } = await admin.from("garage_tokens").insert({ garage_id: garage.id, token_hash: await sha256Hex(registerToken), relink });
  if (insErr) throw insErr;

  const netbirdApiUrl = await getNetbirdApiUrl(admin);
  let setupKey: string | null = null;
  if (createSetupKey) {
    const groupId = await getGaragesGroupId(netbirdApiUrl);
    const garageGroupId = await ensureGarageGroup(netbirdApiUrl, o.name);
    const res = await fetch(`${netbirdApiUrl}/setup-keys`, {
      method: "POST", headers: netbirdHeaders(),
      body: JSON.stringify({ name: o.name, type: "one-off", expires_in: 259200, auto_groups: [groupId, garageGroupId], usage_limit: 1, ephemeral: false }),
    });
    if (!res.ok) {
      console.error("[garage-credentials] NetBird setup-key creation failed", { status: res.status, garage: o.name });
      throw new CredentialError(502, `NetBird setup key creation failed (status ${res.status})`);
    }
    setupKey = (await res.json())?.key ?? null;
    if (setupKey && garage.netbird_peer_id) {
      const oldPeer = garage.netbird_peer_id as string;
      const { error: pinErr } = await admin.from("garages").update({ netbird_peer_id: null }).eq("id", garage.id);
      if (pinErr) throw pinErr;
      garage = { ...garage, netbird_peer_id: null };
      try {
        const del = await fetch(`${netbirdApiUrl}/peers/${encodeURIComponent(oldPeer)}`, { method: "DELETE", headers: netbirdHeaders() });
        const ok = del.ok || del.status === 404;
        await admin.from("onboarding_events").insert({
          garage_id: garage.id, step: "mesh", status: ok ? "done" : "warning",
          message: ok ? "Old mesh peer removed" : `Old mesh peer could not be removed (status ${del.status})`,
        });
      } catch (e) {
        console.error("[garage-credentials] old peer delete failed", { garage: o.name, error: e instanceof Error ? e.message : "unknown" });
      }
    }
  }

  return {
    garage, register_token: registerToken, setup_key: setupKey,
    register_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/register-node`,
    management_url: netbirdApiUrl.replace(/\/api$/, ""),
    reused: !!existing,
  };
}
