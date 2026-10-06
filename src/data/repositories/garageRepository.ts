import { supabase } from "@/integrations/supabase/client";
import type { GarageCredentials } from "@/models/services/garageCommand";

export interface GarageRow {
  id: string;
  name: string;
  operator_id: string | null;
  api_host: string | null;
  runtime: string | null;
  port: number | null;
  models: string[];
  mesh_ip: string | null;
  netbird_peer_id: string | null;
  status: string;
  disabled: boolean;
  last_registered_at: string | null;
  last_heartbeat_at: string | null;
  created_at: string;
  connection_type?: string | null;
  last_gateway_check_at?: string | null;
  mesh_connected?: boolean | null;
  runtime_ok?: boolean | null;
  runtime_error?: string | null;
}

export type GarageModelStatus = "untested" | "testing" | "live" | "failed" | "paused";
export interface GarageModelRow {
  garage_id: string;
  model: string;
  installed: boolean;
  offered: boolean;
  status: GarageModelStatus;
  updated_at: string;
}

export interface DemandModel { model: string; min_gb: number; note?: string }

export interface GarageTestRow {
  id: string;
  garage_id: string;
  model: string;
  passed: boolean;
  http_status: number | null;
  error: string | null;
  ttft_ms: number | null;
  tokens_per_second: number | null;
  instruction_followed: boolean | null;
  supports_tools: boolean | null;
  tools_error: string | null;
  tested_at: string;
}

export interface GarageStatusResult {
  garage: GarageRow;
  mesh: { connected: boolean | null; peer_found: boolean };
  latest_tests: GarageTestRow[];
}

const invoke = async <T>(fn: string, body: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (data?.error) throw new Error(data.error);
  if (error) {
    // Try to surface the function's JSON error message
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    throw new Error(error.message || "Request failed");
  }
  return data as T;
};

export interface ProviderPrices {
  dedicated_input_cost_per_million?: number; dedicated_output_cost_per_million?: number;
  pool_input_cost_per_million?: number; pool_output_cost_per_million?: number;
}
export interface ProviderResult {
  garage: { name: string; display_name: string; endpoint_url: string };
  acceptance: Array<{ model: string; passed: boolean; error?: string | null }>;
}

export const garageRepository = {
  listProviderModels: (endpoint_url: string, api_key: string) =>
    invoke<{ endpoint_url: string; models: string[] }>("create-provider", { list_only: true, endpoint_url, api_key }),

  createProvider: (body: { name: string; display_name: string; endpoint_url: string; api_key?: string; models: string[]; prices: ProviderPrices }) =>
    invoke<ProviderResult>("create-provider", body),

  updateProviderKey: (name: string, api_key: string) =>
    invoke<{ ok: boolean }>("create-provider", { update_key: true, name, api_key }),

  /** RLS returns only the caller's garages (admins see all). */
  async listOwn(userId: string): Promise<GarageRow[]> {
    const { data, error } = await supabase
      .from("garages")
      .select("id, name, operator_id, api_host, runtime, port, models, mesh_ip, netbird_peer_id, status, disabled, last_registered_at, last_heartbeat_at, created_at, connection_type, last_gateway_check_at, mesh_connected, runtime_ok, runtime_error")
      .eq("operator_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as GarageRow[];
  },

  async latestTests(garageIds: string[]): Promise<Map<string, GarageTestRow>> {
    const latest = new Map<string, GarageTestRow>();
    if (garageIds.length === 0) return latest;
    const { data, error } = await supabase
      .from("garage_model_tests")
      .select("*")
      .in("garage_id", garageIds)
      .order("tested_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    for (const t of (data ?? []) as GarageTestRow[]) {
      const key = `${t.garage_id}::${t.model}`;
      if (!latest.has(key)) latest.set(key, t);
    }
    return latest;
  },

  create: (body: { name: string; create_setup_key: boolean }) =>
    invoke<GarageCredentials>("create-garage", body),

  status: (name: string) => invoke<GarageStatusResult>("garage-status", { name }),

  retest: (name: string) =>
    invoke<{ status: string; acceptance: Array<{ model: string; passed: boolean }> }>("retest-garage", { name }),

  setDisabled: (name: string, disabled: boolean) =>
    invoke<{ ok: boolean; status: string }>("set-garage-disabled", { name, disabled }),

  async listModels(garageIds: string[]): Promise<GarageModelRow[]> {
    if (garageIds.length === 0) return [];
    const { data, error } = await supabase.from("garage_models").select("*").in("garage_id", garageIds).order("model");
    if (error) throw error;
    return (data ?? []) as GarageModelRow[];
  },

  setOffered: (name: string, model: string, offered: boolean) =>
    invoke<{ ok: boolean; acceptance: Array<{ model: string; passed: boolean }> }>("set-model-offered", { name, model, offered }),

  async demandModels(): Promise<DemandModel[]> {
    const { data, error } = await supabase.from("admin_settings").select("value").eq("key", "demand_models").maybeSingle();
    if (error) throw error;
    return Array.isArray(data?.value) ? (data.value as unknown as DemandModel[]) : [];
  },

  async operatorEmails(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const { data, error } = await supabase.from("profiles").select("id, email").in("id", ids);
    if (error) throw error;
    for (const p of data ?? []) map.set(p.id, p.email);
    return map;
  },
};
