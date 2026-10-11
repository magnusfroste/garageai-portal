import { useMutation, useQuery } from "@tanstack/react-query";
import { bridgeLinkRepository } from "@/data/repositories/bridgeLinkRepository";
import { isUserCode } from "@/models/services/bridgeLinkService";

export const useBridgeLink = (code: string, enabled: boolean) => {
  const lookup = useQuery({
    queryKey: ["bridge-link", code],
    enabled: enabled && isUserCode(code),
    retry: false,
    queryFn: () => bridgeLinkRepository.lookup(code),
  });
  const approve = useMutation({ mutationFn: bridgeLinkRepository.approve });
  const deny = useMutation({ mutationFn: () => bridgeLinkRepository.deny(code) });
  return { lookup, approve, deny };
};
