import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  last_registered_at: string | null;
  created_at: string;
}

export interface CreateGarageResult {
  garage: { id: string; name: string };
  register_token: string;
  setup_key: string | null;
  register_url: string;
  management_url: string;
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
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    createGarage,
  };
};
