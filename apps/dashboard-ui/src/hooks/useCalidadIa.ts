import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useCalidadIa() {
  return useQuery({
    queryKey: ['calidad-ia'],
    queryFn: api.calidadIa,
    staleTime: 60_000, // 1 min - auditoria es pesada, no refrescar cada segundo
    refetchOnWindowFocus: false,
  });
}
