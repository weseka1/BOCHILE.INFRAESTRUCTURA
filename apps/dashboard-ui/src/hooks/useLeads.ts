import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Lead } from '@/types/domain';
import { isInternalPhone } from '@/lib/internalPhones';

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: api.leads,
    staleTime: 30_000,
    // Filtrar leads de telefonos internos (Camila, duenos, Maxi, alquileres)
    select: (data) => (data ?? []).filter(l => !isInternalPhone(l.telefono)),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead_id, patch }: { lead_id: string; patch: Partial<Lead> }) => {
      return api.updateLead(lead_id, patch);
    },
    onMutate: async ({ lead_id, patch }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const prev = qc.getQueryData<Lead[]>(['leads']) ?? [];
      qc.setQueryData<Lead[]>(['leads'], prev.map(l =>
        l.lead_id === lead_id ? { ...l, ...patch } : l,
      ));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['leads'], ctx.prev);
    },
    onSuccess: (saved, { lead_id }) => {
      qc.setQueryData<Lead[]>(['leads'], (old = []) =>
        old.map(l => l.lead_id === lead_id ? { ...l, ...saved } : l),
      );
      // Las visitas virtuales dependen de la etapa del lead, las metricas tambien
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}
