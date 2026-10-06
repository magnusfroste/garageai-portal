import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { apiKeyService } from "@/models/services/apiKeyService";
import { ApiKey } from "@/models/types/apiKey.types";

export const useDashboardData = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setIsError(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const keys = await apiKeyService.getKeysForCurrentUser();
      setApiKeys(keys);
    } catch (error) {
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return {
    apiKeys,
    loading,
    isError,
    refetch: loadData,
  };
};
