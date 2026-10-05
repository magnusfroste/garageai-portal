import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { garageRepository } from "@/data/repositories/garageRepository";

export interface Garage {
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
}

export interface CreateGarageResult {
  garage: { id: string; name: string };
  register_token: string;
  setup_key: string | null;
  register_url: string;
  management_url: string;
}

export interface GarageModelTest {
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

export const useGarages = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-garages"],
    queryFn: async (): Promise<Garage[]> => {
      const { data, error } = await supabase
        .from("garages" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Garage[];
    },
  });

  const testsQuery = useQuery({
    queryKey: ["admin-garage-tests"],
    queryFn: async (): Promise<Map<string, GarageModelTest>> => {
      const { data, error } = await supabase
        .from("garage_model_tests")
        .select("*")
        .order("tested_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Latest test per garage+model
      const latest = new Map<string, GarageModelTest>();
      for (const t of (data ?? []) as GarageModelTest[]) {
        const key = `${t.garage_id}::${t.model}`;
        if (!latest.has(key)) latest.set(key, t);
      }
      return latest;
    },
  });

  const operatorIds = Array.from(new Set((query.data ?? []).map((g) => g.operator_id).filter((x): x is string => !!x)));
  const emailsQuery = useQuery({
    queryKey: ["admin-garage-operators", operatorIds.join(",")],
    enabled: operatorIds.length > 0,
    queryFn: () => garageRepository.operatorEmails(operatorIds),
  });

  const setGarageDisabled = async (name: string, disabled: boolean) => {
    const res = await garageRepository.setDisabled(name, disabled);
    queryClient.invalidateQueries({ queryKey: ["admin-garages"] });
    return res;
  };

  const retestGarage = async (name: string) => {
    const { data, error } = await supabase.functions.invoke("retest-garage", { body: { name } });
    if (error) throw new Error(error.message || "Retest failed");
    if (data?.error) throw new Error(data.error);
    queryClient.invalidateQueries({ queryKey: ["admin-garages"] });
    queryClient.invalidateQueries({ queryKey: ["admin-garage-tests"] });
    return data as { status: string; acceptance: Array<{ model: string; passed: boolean }> };
  };

  const createGarage = async (body: {
    name: string;
    api_host?: string;
    create_setup_key: boolean;
  }): Promise<CreateGarageResult> => {
    const { data, error } = await supabase.functions.invoke("create-garage", { body });
    if (error) throw new Error(error.message || "Failed to create garage");
    if (data?.error) throw new Error(data.error);
    queryClient.invalidateQueries({ queryKey: ["admin-garages"] });
    return data as CreateGarageResult;
  };

  return {
    garages: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => { testsQuery.refetch(); return query.refetch(); },
    isRefetching: query.isRefetching,
    createGarage,
    latestTests: testsQuery.data ?? new Map<string, GarageModelTest>(),
    retestGarage,
    operatorEmails: emailsQuery.data ?? new Map<string, string>(),
    setGarageDisabled,
  };
};
