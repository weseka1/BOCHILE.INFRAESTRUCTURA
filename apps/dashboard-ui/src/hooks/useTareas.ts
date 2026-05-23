import { useCallback, useEffect, useState } from 'react';

export type TareaPrioridad = 'alta' | 'media' | 'baja';
export type TareaEstado = 'pendiente' | 'en_curso' | 'completada';

export interface Tarea {
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

const STORAGE_KEY = 'bochile.tareas.v1';
const EVENT_NAME = 'bochile:tareas-updated';

function readAll(): Tarea[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Tarea[];
  } catch {
    return [];
  }
}

function writeAll(tareas: Tarea[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tareas));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function newId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useTareas() {
  const [tareas, setTareas] = useState<Tarea[]>(() => readAll());

  useEffect(() => {
    const sync = () => setTareas(readAll());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const crear = useCallback((input: Omit<Tarea, 'id' | 'creada_en' | 'estado'> & { estado?: TareaEstado }) => {
    const nueva: Tarea = {
      id: newId(),
      creada_en: new Date().toISOString(),
      estado: input.estado ?? 'pendiente',
      ...input,
    };
    const next = [nueva, ...readAll()];
    writeAll(next);
    return nueva;
  }, []);

  const actualizar = useCallback((id: string, patch: Partial<Tarea>) => {
    const next = readAll().map(t => t.id === id ? { ...t, ...patch } : t);
    writeAll(next);
  }, []);

  const eliminar = useCallback((id: string) => {
    writeAll(readAll().filter(t => t.id !== id));
  }, []);

  const toggleCompletada = useCallback((id: string) => {
    const all = readAll();
    const next = all.map(t => {
      if (t.id !== id) return t;
      if (t.estado === 'completada') {
        const { completada_en, ...rest } = t;
        return { ...rest, estado: 'pendiente' as TareaEstado };
      }
      return { ...t, estado: 'completada' as TareaEstado, completada_en: new Date().toISOString() };
    });
    writeAll(next);
  }, []);

  return { tareas, crear, actualizar, eliminar, toggleCompletada };
}

export function useTareasCount(): number {
  const [count, setCount] = useState(() => readAll().filter(t => t.estado !== 'completada').length);
  useEffect(() => {
    const sync = () => setCount(readAll().filter(t => t.estado !== 'completada').length);
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return count;
}
