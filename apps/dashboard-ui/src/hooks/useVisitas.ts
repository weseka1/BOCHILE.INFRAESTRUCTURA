import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useVisitas() {
  return useQuery({ queryKey: ['visitas'], queryFn: api.visitas, staleTime: 30_000 });
}
