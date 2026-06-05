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
import { getAuthToken } from '@/services/api';
const ENV_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;
const BASE = ENV_URL ? `${ENV_URL.replace(/\/$/, '')}/api` : '/api';

// withAuth: inyecta credentials + Authorization Bearer. Sin esto /api/tareas
// devolvia 401 cross-origin -> el dashboard mostraba 0 tareas con el sheet lleno.
function withAuth(init: RequestInit = {}): RequestInit {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;
  return { ...init, credentials: 'include', headers };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, withAuth());
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, withAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, withAuth({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function delReq<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, withAuth({ method: 'DELETE' }));
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

// Antes habia auto-clean que borraba las completadas 3s despues. Quitado:
// las completadas persisten en el Sheet hasta que el usuario las elimine
// manualmente (boton trash individual, bulk "Eliminar", o "Limpiar completadas").

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

  // Helper: aplica un cambio al cache local de react-query SIN refetch.
  // Esto evita el race condition: si despues de POST/PATCH hacemos refetch
  // inmediato, Google Sheets a veces tarda ~500ms en propagar la escritura
  // y devuelve la lista vieja => la tarea recien creada "desaparece" de la UI.
  // setQueryData garantiza que la UI ya tiene el dato sin esperar el round-trip.
  function setCache(updater: (old: Tarea[]) => Tarea[]) {
    qc.setQueryData<Tarea[]>(['tareas'], (old) => updater(old ?? []));
  }

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
    const nueva = fromApi(saved);
    setCache((old) => [nueva, ...old.filter(t => t.id !== nueva.id)]);
    return nueva;
  }, [qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const actualizar = useCallback(async (id: string, patch: Partial<Tarea>) => {
    // Optimistic: actualizo cache ANTES del round-trip para feedback inmediato.
    setCache((old) => old.map(t => t.id === id ? { ...t, ...patch } : t));
    try {
      const updated = await patchJson<TareaApi>(`/tareas/${encodeURIComponent(id)}`, toApi(patch));
      setCache((old) => old.map(t => t.id === id ? fromApi(updated) : t));
    } catch (e) {
      // Si falla, fuerzo refetch para volver al estado real del sheet
      qc.invalidateQueries({ queryKey: ['tareas'] });
      throw e;
    }
  }, [qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const eliminar = useCallback(async (id: string) => {
    // Optimistic: saco la tarea de la UI ya
    const prev = qc.getQueryData<Tarea[]>(['tareas']) ?? [];
    setCache((old) => old.filter(t => t.id !== id));
    try {
      await delReq(`/tareas/${encodeURIComponent(id)}`);
    } catch (e) {
      qc.setQueryData(['tareas'], prev); // rollback
      throw e;
    }
  }, [qc]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const idSet = new Set(ids);
    const prev = qc.getQueryData<Tarea[]>(['tareas']) ?? [];
    setCache((old) => old.filter(t => !idSet.has(t.id)));
    try {
      await Promise.all(ids.map(id => delReq(`/tareas/${encodeURIComponent(id)}`)));
    } catch (e) {
      qc.setQueryData(['tareas'], prev);
      throw e;
    }
  }, [qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const actualizarVarios = useCallback(async (ids: string[], patch: Partial<Tarea>) => {
    const idSet = new Set(ids);
    setCache((old) => old.map(t => idSet.has(t.id) ? { ...t, ...patch } : t));
    try {
      await Promise.all(ids.map(id => patchJson(`/tareas/${encodeURIComponent(id)}`, toApi(patch))));
    } catch (e) {
      qc.invalidateQueries({ queryKey: ['tareas'] });
      throw e;
    }
  }, [qc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Atajo: borrar todas las tareas en estado completada del Sheet
  const limpiarCompletadas = useCallback(async () => {
    const ids = tareas.filter(t => t.estado === 'completada').map(t => t.id);
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const prev = qc.getQueryData<Tarea[]>(['tareas']) ?? [];
    setCache((old) => old.filter(t => !idSet.has(t.id)));
    try {
      await Promise.all(ids.map(id => delReq(`/tareas/${encodeURIComponent(id)}`)));
    } catch (e) {
      qc.setQueryData(['tareas'], prev);
      throw e;
    }
    return ids.length;
  }, [tareas, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tareas,
    isLoading: query.isLoading,
    error: query.error,
    crear, actualizar, eliminar, toggleCompletada, eliminarVarios, actualizarVarios, limpiarCompletadas,
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
