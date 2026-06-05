import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Empleado } from '@/types/domain';

export function useEmpleados() {
  return useQuery({ queryKey: ['empleados'], queryFn: api.empleados, staleTime: 120_000 });
}

export function useUpdateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ empleado_id, patch }: { empleado_id: string; patch: Partial<Empleado> }) => {
      return api.updateEmpleado(empleado_id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empleados'] });
    },
  });
}
