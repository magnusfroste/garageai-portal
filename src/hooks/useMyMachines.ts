import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { garageRepository } from '@/data/repositories/garageRepository';
import { ownMachineModels } from '@/models/services/myMachineService';
import { useSession } from './useSession';

export function useMyMachines() {
  const { session, loading } = useSession();
  const userId = session?.user.id ?? '';
  const query = useQuery({ queryKey: ['my-machines', userId], enabled: !!userId, refetchInterval: 30_000,
    queryFn: async () => {
      const garages = await garageRepository.listOwn(userId);
      const rows = await garageRepository.listModels(garages.map(g => g.id));
      return { garages, rows };
    },
  });
  return { userId, isLoading: loading || (!!userId && query.isLoading), models: useMemo(() => ownMachineModels(query.data?.garages ?? [], query.data?.rows ?? [], userId), [query.data, userId]) };
}