import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { garageRepository, GarageTestRow } from "@/data/repositories/garageRepository";

const useUserId = () => {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  return userId;
};

export const useMyGarages = () => {
  const userId = useUserId();
  const qc = useQueryClient();

  const garagesQuery = useQuery({
    queryKey: ["my-garages", userId],
    enabled: !!userId,
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return garageRepository.listOwn(userId);
    },
  });

  const ids = (garagesQuery.data ?? []).map((g) => g.id);
  const testsQuery = useQuery({
    queryKey: ["my-garage-tests", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: () => garageRepository.latestTests(ids),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-garages"] });
    qc.invalidateQueries({ queryKey: ["my-garage-tests"] });
  };

  return {
    garages: garagesQuery.data ?? [],
    isLoading: !userId || garagesQuery.isLoading,
    isError: garagesQuery.isError,
    latestTests: testsQuery.data ?? new Map<string, GarageTestRow>(),
    invalidate,
  };
};
