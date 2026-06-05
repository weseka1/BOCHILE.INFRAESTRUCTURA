import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Empleado } from '@/types/domain';

export function useEmpleados() {
  return useQuery({ queryKey: ['empleados'], queryFn: api.empleados, staleTime: 120_000 });
}

/**
 * Optimistic update: aplicamos el patch al cache local apenas se dispara
 * la mutation, ANTES de esperar la confirmacion del backend. Si falla,
 * rollback. Esto evita el "race condition" tipico donde el GET inmediato
 * post-update trae el cache viejo del backend y la UI parece "borrar"
 * el cambio que el usuario acaba de hacer.
 */
export function useUpdateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ empleado_id, patch }: { empleado_id: string; patch: Partial<Empleado> }) => {
      return api.updateEmpleado(empleado_id, patch);
    },
    onMutate: async ({ empleado_id, patch }) => {
      await qc.cancelQueries({ queryKey: ['empleados'] });
      const prev = qc.getQueryData<Empleado[]>(['empleados']) ?? [];
      qc.setQueryData<Empleado[]>(['empleados'], prev.map(e =>
        e.empleado_id === empleado_id ? { ...e, ...patch } : e,
      ));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['empleados'], ctx.prev);
    },
    onSuccess: (saved, { empleado_id }) => {
      qc.setQueryData<Empleado[]>(['empleados'], (old = []) =>
        old.map(e => e.empleado_id === empleado_id ? { ...e, ...saved } : e),
      );
    },
  });
}

export function useCreateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Empleado>) => api.createEmpleado(data),
    onSuccess: (saved) => {
      qc.setQueryData<Empleado[]>(['empleados'], (old = []) => {
        if (old.some(e => e.empleado_id === saved.empleado_id)) return old;
        return [...old, saved];
      });
    },
  });
}
