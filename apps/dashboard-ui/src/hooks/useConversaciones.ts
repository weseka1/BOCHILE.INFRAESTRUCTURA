import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useConversaciones() {
  return useQuery({
    queryKey: ['conversaciones'],
    queryFn: api.conversaciones,
    staleTime: 5_000,
    refetchInterval: 15_000, // near-realtime: refresca cada 15s mientras la tab esta abierta
    refetchIntervalInBackground: false, // no consume cuota si la tab no esta visible
  });
}
