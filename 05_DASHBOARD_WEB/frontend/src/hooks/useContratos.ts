import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useContratos() {
  return useQuery({ queryKey: ['contratos'], queryFn: api.contratos, staleTime: 60_000 });
}
