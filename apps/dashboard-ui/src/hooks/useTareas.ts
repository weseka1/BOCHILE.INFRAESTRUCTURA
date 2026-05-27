import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type TareaPrioridad = 'alta' | 'media' | 'baja';
export type TareaEstado = 'pendiente' | 'en_curso' | 'completada';

export interface Tarea {
  /** id local en el frontend (mapeado a tarea_id del backend) */
  id: string;
  titulo: string;
  descripcion?: string;
  prioridad: TareaPrioridad;
  estado: TareaEstado;
  asignado_a?: string;
  vencimiento?: string;
  creada_en: string;
  completada_en?: string;
}

// ====== Resolucion del base URL (igual que api.ts) ======
const ENV_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;
const BASE = ENV_URL ? `${ENV_URL.replace(/\/$/, '')}/api` : '/api';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function delReq<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ====== Mapeo backend <-> frontend ======
// Backend usa `tarea_id`, frontend usa `id` (legacy de la version localStorage).
interface TareaApi {
  tarea_id: string;
  titulo: string;
  descripcion?: string;
  prioridad: string;
  estado: string;
  asignado_a?: string;
  vencimiento?: string;
  creada_en: string;
  completada_en?: string;
}
function fromApi(t: TareaApi): Tarea {
  return {
    id: t.tarea_id,
    titulo: t.titulo,
    descripcion: t.descripcion || undefined,
    prioridad: (t.prioridad || 'media') as TareaPrioridad,
    estado: (t.estado || 'pendiente') as TareaEstado,
    asignado_a: t.asignado_a || undefined,
    vencimiento: t.vencimiento || undefined,
    creada_en: t.creada_en,
    completada_en: t.completada_en || undefined,
  };
}
function toApi(t: Partial<Tarea>): Partial<TareaApi> {
  const out: Partial<TareaApi> = {};
  if (t.id !== undefined) out.tarea_id = t.id;
  if (t.titulo !== undefined) out.titulo = t.titulo;
  if (t.descripcion !== undefined) out.descripcion = t.descripcion ?? '';
  if (t.prioridad !== undefined) out.prioridad = t.prioridad;
  if (t.estado !== undefined) out.estado = t.estado;
  if (t.asignado_a !== undefined) out.asignado_a = t.asignado_a ?? '';
  if (t.vencimiento !== undefined) out.vencimiento = t.vencimiento ?? '';
  if (t.creada_en !== undefined) out.creada_en = t.creada_en;
  if (t.completada_en !== undefined) out.completada_en = t.completada_en ?? '';
  return out;
}

// ====== Auto-clean: cuando una tarea pasa a "completada", la borramos del Sheet
// despues de 3 segundos. UI ya la oculta inmediatamente del listado activo
// (en TareasPage el filtro default es != completada).
const AUTOCLEAN_DELAY_MS = 3000;
const pendingCleanups = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleAutoClean(id: string, qc: ReturnType<typeof useQueryClient>) {
  const existing = pendingCleanups.get(id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    try {
      await delReq(`/tareas/${encodeURIComponent(id)}`);
    } catch { /* ignore - puede haber sido borrada manual */ }
    pendingCleanups.delete(id);
    qc.invalidateQueries({ queryKey: ['tareas'] });
  }, AUTOCLEAN_DELAY_MS);
  pendingCleanups.set(id, timer);
}

function cancelAutoClean(id: string) {
  const t = pendingCleanups.get(id);
  if (t) { clearTimeout(t); pendingCleanups.delete(id); }
}

// ====== Hook principal ======
export function useTareas() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tareas'],
    queryFn: async () => {
      const arr = await getJson<TareaApi[]>('/tareas');
      return arr.map(fromApi);
    },
    staleTime: 15_000,
  });

  const tareas = query.data ?? [];

  const crear = useCallback(async (input: Omit<Tarea, 'id' | 'creada_en' | 'estado'> & { estado?: TareaEstado }) => {
    const ahora = new Date().toISOString();
    const payload: Partial<TareaApi> = {
      titulo: input.titulo,
      descripcion: input.descripcion ?? '',
      prioridad: input.prioridad,
      estado: input.estado ?? 'pendiente',
      asignado_a: input.asignado_a ?? '',
      vencimiento: input.vencimiento ?? '',
      creada_en: ahora,
    };
    const saved = await postJson<TareaApi>('/tareas', payload);
    qc.invalidateQueries({ queryKey: ['tareas'] });
    return fromApi(saved);
  }, [qc]);

  const actualizar = useCallback(async (id: string, patch: Partial<Tarea>) => {
    const wasCompleting = patch.estado === 'completada';
    const wasUncompleting = patch.estado && patch.estado !== 'completada';
    await patchJson(`/tareas/${encodeURIComponent(id)}`, toApi(patch));
    qc.invalidateQueries({ queryKey: ['tareas'] });
    if (wasCompleting) scheduleAutoClean(id, qc);
    if (wasUncompleting) cancelAutoClean(id);
  }, [qc]);

  const eliminar = useCallback(async (id: string) => {
    cancelAutoClean(id);
    await delReq(`/tareas/${encodeURIComponent(id)}`);
    qc.invalidateQueries({ queryKey: ['tareas'] });
  }, [qc]);

  const toggleCompletada = useCallback(async (id: string) => {
    const cur = tareas.find(t => t.id === id);
    if (!cur) return;
    if (cur.estado === 'completada') {
      await actualizar(id, { estado: 'pendiente', completada_en: '' });
    } else {
      await actualizar(id, { estado: 'completada', completada_en: new Date().toISOString() });
    }
  }, [tareas, actualizar]);

  const eliminarVarios = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map(id => { cancelAutoClean(id); return delReq(`/tareas/${encodeURIComponent(id)}`); }));
    qc.invalidateQueries({ queryKey: ['tareas'] });
  }, [qc]);

  const actualizarVarios = useCallback(async (ids: string[], patch: Partial<Tarea>) => {
    await Promise.all(ids.map(id => patchJson(`/tareas/${encodeURIComponent(id)}`, toApi(patch))));
    qc.invalidateQueries({ queryKey: ['tareas'] });
    if (patch.estado === 'completada') ids.forEach(id => scheduleAutoClean(id, qc));
    if (patch.estado && patch.estado !== 'completada') ids.forEach(cancelAutoClean);
  }, [qc]);

  return {
    tareas,
    isLoading: query.isLoading,
    error: query.error,
    crear, actualizar, eliminar, toggleCompletada, eliminarVarios, actualizarVarios,
  };
}

// Hook para el badge del sidebar (cuenta pendientes/en_curso, NO completadas)
export function useTareasCount(): number {
  const { data } = useQuery({
    queryKey: ['tareas'],
    queryFn: async () => {
      const arr = await getJson<TareaApi[]>('/tareas');
      return arr.map(fromApi);
    },
    staleTime: 15_000,
  });
  if (!data) return 0;
  return data.filter(t => t.estado !== 'completada').length;
}
