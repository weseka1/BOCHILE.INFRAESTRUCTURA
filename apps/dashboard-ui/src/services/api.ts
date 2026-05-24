/**
 * Wrapper minimal de fetch contra el backend.
 * Local dev: Vite proxea /api -> http://localhost:3002 (ver vite.config.ts)
 * Render: VITE_API_URL apunta al hostport del bochile-dashboard-api (ej https://bochile-dashboard-api.onrender.com)
 */

const ENV_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;
const BASE = ENV_URL ? `${ENV_URL.replace(/\/$/, '')}/api` : '/api';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<{ status: string }>(`/health`),
  leads: () => getJson<import('@/types/domain').Lead[]>(`/leads`),
  propiedades: () => getJson<import('@/types/domain').Propiedad[]>(`/propiedades`),
  visitas: () => getJson<import('@/types/domain').Visita[]>(`/visitas`),
  createVisita: (v: Partial<import('@/types/domain').Visita>) =>
    postJson<import('@/types/domain').Visita>(`/visitas`, v),
  contratos: () => getJson<import('@/types/domain').Contrato[]>(`/contratos`),
  empleados: () => getJson<import('@/types/domain').Empleado[]>(`/empleados`),
  matches: () => getJson<import('@/types/domain').MatchPendiente[]>(`/matches`),
  conversaciones: () => getJson<import('@/types/domain').Conversacion[]>(`/conversaciones`),
  acciones: () => getJson<import('@/types/domain').AccionIA[]>(`/acciones`),
  metrics: () => getJson<import('@/types/domain').Metrics>(`/metrics`),
};
