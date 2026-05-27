import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Visita } from '@/types/domain';

export function useVisitas() {
  return useQuery({ queryKey: ['visitas'], queryFn: api.visitas, staleTime: 30_000 });
}

export function useCreateVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Partial<Visita>) => api.createVisita(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}

export function useUpdateVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ visita_id, patch }: { visita_id: string; patch: Partial<Visita> }) =>
      api.updateVisita(visita_id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}
