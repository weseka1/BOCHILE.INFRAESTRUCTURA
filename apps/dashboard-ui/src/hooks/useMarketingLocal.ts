import { useCallback, useEffect, useState } from 'react';

/**
 * Hooks para datos del PANEL MARKETING que se persisten en el navegador.
 * Intencionalmente NO tocan el backend para no arriesgar el sheet en la entrega.
 * Si despues queres multi-dispositivo, se puede migrar a /api/marketing/*.
 */

export interface Objetivo {
  id: string;
  titulo: string;
  meta: number;       // ej. 30 (clientes nuevos)
  unidad: string;     // ej. "clientes", "visitas", "ventas"
  actual: number;     // progreso manual o auto
  creado_en: string;
}

export interface PuntoMejora {
  id: string;
  titulo: string;
  descripcion?: string;
  estado: 'abierto' | 'en_progreso' | 'resuelto';
  prioridad: 'alta' | 'media' | 'baja';
  creado_en: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function useLocalState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch { return fallback; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

// ---------------- OBJETIVOS DEL MES ----------------

const OBJ_KEY = 'bochile_marketing_objetivos_v1';

export function useObjetivosMes() {
  const [items, setItems] = useLocalState<Objetivo[]>(OBJ_KEY, []);

  const crear = useCallback((data: Omit<Objetivo, 'id' | 'creado_en' | 'actual'> & { actual?: number }) => {
    const nuevo: Objetivo = {
      id: uid(),
      titulo: data.titulo,
      meta: Number(data.meta) || 0,
      unidad: data.unidad || '',
      actual: Number(data.actual ?? 0),
      creado_en: new Date().toISOString(),
    };
    setItems(prev => [nuevo, ...prev]);
  }, [setItems]);

  const actualizar = useCallback((id: string, patch: Partial<Objetivo>) => {
    setItems(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  }, [setItems]);

  const eliminar = useCallback((id: string) => {
    setItems(prev => prev.filter(o => o.id !== id));
  }, [setItems]);

  return { objetivos: items, crear, actualizar, eliminar };
}

// ---------------- PUNTOS A MEJORAR ----------------

const PM_KEY = 'bochile_marketing_puntos_mejora_v1';

export function usePuntosMejora() {
  const [items, setItems] = useLocalState<PuntoMejora[]>(PM_KEY, []);

  const crear = useCallback((data: Omit<PuntoMejora, 'id' | 'creado_en' | 'estado' | 'prioridad'> & { estado?: PuntoMejora['estado']; prioridad?: PuntoMejora['prioridad'] }) => {
    const nuevo: PuntoMejora = {
      id: uid(),
      titulo: data.titulo,
      descripcion: data.descripcion,
      estado: data.estado || 'abierto',
      prioridad: data.prioridad || 'media',
      creado_en: new Date().toISOString(),
    };
    setItems(prev => [nuevo, ...prev]);
  }, [setItems]);

  const actualizar = useCallback((id: string, patch: Partial<PuntoMejora>) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, [setItems]);

  const eliminar = useCallback((id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
  }, [setItems]);

  return { puntos: items, crear, actualizar, eliminar };
}
