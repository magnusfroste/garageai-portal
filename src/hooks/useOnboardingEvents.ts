import { useQuery } from "@tanstack/react-query";
import { onboardingEventRepository } from "@/data/repositories/onboardingEventRepository";

/** Onboarding events for one garage; polls every 5 s while `poll` is true. */
export const useOnboardingEvents = (garageId: string | null | undefined, poll = false) =>
  useQuery({
    queryKey: ["onboarding-events", garageId],
    enabled: !!garageId,
    queryFn: () => onboardingEventRepository.forGarage(garageId!),
    refetchInterval: (q) => (poll && q.state.data?.[0]?.status !== "done" ? 5000 : false),
  });

export const useLatestOnboardingEvents = (garageIds: string[]) =>
  useQuery({
    queryKey: ["onboarding-latest", [...garageIds].sort().join(",")],
    enabled: garageIds.length > 0,
    queryFn: () => onboardingEventRepository.latestFor(garageIds),
    refetchInterval: 30_000,
  });
