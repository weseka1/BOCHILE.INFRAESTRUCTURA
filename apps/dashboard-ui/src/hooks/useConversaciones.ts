import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useConversaciones() {
  return useQuery({
    queryKey: ['conversaciones'],
    queryFn: api.conversaciones,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
