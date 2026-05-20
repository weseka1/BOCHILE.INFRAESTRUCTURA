/**
 * Wrapper minimal de fetch contra el backend.
 * En desarrollo, Vite proxea /api -> http://localhost:3001 (ver vite.config.ts)
 */

const BASE = '/api';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<{ status: string }>(`/health`),
  leads: () => getJson<import('@/types/domain').Lead[]>(`/leads`),
  propiedades: () => getJson<import('@/types/domain').Propiedad[]>(`/propiedades`),
  visitas: () => getJson<import('@/types/domain').Visita[]>(`/visitas`),
  contratos: () => getJson<import('@/types/domain').Contrato[]>(`/contratos`),
  empleados: () => getJson<import('@/types/domain').Empleado[]>(`/empleados`),
  matches: () => getJson<import('@/types/domain').MatchPendiente[]>(`/matches`),
  conversaciones: () => getJson<import('@/types/domain').Conversacion[]>(`/conversaciones`),
  acciones: () => getJson<import('@/types/domain').AccionIA[]>(`/acciones`),
  metrics: () => getJson<import('@/types/domain').Metrics>(`/metrics`),
};
