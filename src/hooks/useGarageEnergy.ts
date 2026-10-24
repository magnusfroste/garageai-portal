import {useQuery} from '@tanstack/react-query';
import {energyRepository} from '@/data/repositories/energyRepository';
export const useGarageEnergy = (id: string) => useQuery({queryKey:['garage-energy',id],queryFn:()=>energyRepository.garage(id),enabled:!!id,refetchInterval:60000});
export const usePublicModelEnergy = (model: string) => useQuery({queryKey:['public-model-energy',model],queryFn:()=>energyRepository.publicModel(model),enabled:!!model,staleTime:60000});
