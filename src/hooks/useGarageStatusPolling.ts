import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { garageRepository } from "@/data/repositories/garageRepository";

const POLL_MS = 5000;
const MAX_MS = 15 * 60 * 1000;

/** Polls garage-status every 5 s for up to 15 minutes (stops early once a model passed). */
export const useGarageStatusPolling = (name: string | null) => {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setStartedAt(name ? Date.now() : null);
  }, [name]);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(t);
  }, [startedAt]);

  const timedOut = !!startedAt && now - startedAt > MAX_MS;

  const query = useQuery({
    queryKey: ["garage-status", name],
    enabled: !!name,
    queryFn: () => garageRepository.status(name!),
    refetchInterval: (q) => {
      const live = q.state.data?.latest_tests.some((t) => t.passed);
      return live || timedOut ? false : POLL_MS;
    },
  });

  return { ...query, timedOut, restart: () => { setStartedAt(Date.now()); setNow(Date.now()); query.refetch(); } };
};
