import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useMatches() {
  return useQuery({ queryKey: ['matches'], queryFn: api.matches, staleTime: 30_000 });
}
