import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useAcciones() {
  return useQuery({ queryKey: ['acciones'], queryFn: api.acciones, staleTime: 15_000 });
}
