import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useEmpleados() {
  return useQuery({ queryKey: ['empleados'], queryFn: api.empleados, staleTime: 120_000 });
}
