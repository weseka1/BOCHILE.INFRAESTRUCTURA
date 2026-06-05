import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Lead } from '@/types/domain';

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: api.leads,
    staleTime: 30_000,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead_id, patch }: { lead_id: string; patch: Partial<Lead> }) => {
      return api.updateLead(lead_id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}
