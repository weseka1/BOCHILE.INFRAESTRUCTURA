import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: api.leads,
    staleTime: 30_000,
  });
}
