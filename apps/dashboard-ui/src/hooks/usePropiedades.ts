import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function usePropiedades() {
  return useQuery({
    queryKey: ['propiedades'],
    queryFn: api.propiedades,
    staleTime: 60_000,
  });
}
