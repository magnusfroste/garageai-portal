import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { managementKeyRepository } from '@/data/repositories/managementKeyRepository';

export function useManagementKeys() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['management-keys'], queryFn: managementKeyRepository.list, refetchOnWindowFocus: false });
  const done = () => qc.invalidateQueries({ queryKey: ['management-keys'] });
  const create = useMutation({ mutationFn: ({ name, expiresAt }: { name: string; expiresAt: string | null }) => managementKeyRepository.create(name, expiresAt), onSuccess: done });
  const rotate = useMutation({ mutationFn: managementKeyRepository.rotate, onSuccess: done });
  const revoke = useMutation({ mutationFn: managementKeyRepository.revoke, onSuccess: done });
  return { list, create, rotate, revoke };
}
