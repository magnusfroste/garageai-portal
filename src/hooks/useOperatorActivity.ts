import { useQuery } from "@tanstack/react-query";
import { useSession } from "./useSession";
import { operatorActivityRepository } from "@/data/repositories/operatorActivityRepository";
export const useOperatorActivity = () => {
  const { session } = useSession();
  return useQuery({ queryKey: ["operator-activity", session?.user.id], enabled: !!session, queryFn: operatorActivityRepository.fetch, staleTime: 60000 });
};