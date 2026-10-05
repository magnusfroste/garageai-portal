import { useQuery } from "@tanstack/react-query";
import { reliabilityRepository } from "@/data/repositories/reliabilityRepository";
import { bestGrade, groupReliability } from "@/models/services/reliabilityService";
import type { GarageReliability, ReliabilityGrade } from "@/models/types/reliability.types";

const STALE = 5 * 60 * 1000;

/** Reliability for all garages (or a subset). Empty for signed-out visitors. */
export const useGarageReliability = (names?: string[]) => {
  const q = useQuery({
    queryKey: ["garage-reliability", names?.join(",") ?? "all"],
    queryFn: async () => groupReliability(await reliabilityRepository.windows(names)),
    staleTime: STALE,
    retry: false,
  });
  return { reliability: q.data ?? new Map<string, GarageReliability>(), isLoading: q.isLoading };
};

/** Grades for buyer model lists, including pool summaries per model name. */
export const useModelGarageGrades = () => {
  const { reliability } = useGarageReliability();
  const pool = useQuery({
    queryKey: ["pool-membership"],
    queryFn: () => reliabilityRepository.poolMembership(),
    staleTime: STALE,
    retry: false,
  });
  const gradeOf = (garage: string | null | undefined): ReliabilityGrade | null =>
    garage ? reliability.get(garage)?.grade ?? null : null;
  const poolSummary = (modelName: string): { count: number; best: ReliabilityGrade | null } | null => {
    const garages = pool.data?.get(modelName);
    if (!garages?.length) return null;
    const grades = garages.map((g) => reliability.get(g)?.grade).filter((g): g is ReliabilityGrade => !!g);
    return { count: garages.length, best: bestGrade(grades) };
  };
  return { gradeOf, poolSummary, hasData: reliability.size > 0 };
};

export const useGarageProfile = (name: string | undefined) =>
  useQuery({
    queryKey: ["garage-profile", name],
    enabled: !!name,
    queryFn: () => reliabilityRepository.profile(name!),
    staleTime: STALE,
  });

export const useOfflinePeriods = (name: string | undefined) =>
  useQuery({
    queryKey: ["garage-offline-periods", name],
    enabled: !!name,
    queryFn: () => reliabilityRepository.offlinePeriods(name!, 5),
    staleTime: STALE,
  });
