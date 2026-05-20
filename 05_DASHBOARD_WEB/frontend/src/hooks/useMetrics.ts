import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: api.metrics,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
