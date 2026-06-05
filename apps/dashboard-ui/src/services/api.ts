/**
 * Wrapper minimal de fetch contra el backend.
 * Local dev: Vite proxea /api -> http://localhost:3002 (ver vite.config.ts)
 * Render: VITE_API_URL apunta al hostport del bochile-dashboard-api (ej https://bochile-dashboard-api.onrender.com)
 *
 * Auth:
 *  - credentials: 'include' para mandar la cookie httpOnly del JWT.
 *  - Interceptor 401: redirige a /login (excepto cuando estamos llamando endpoints de auth).
 */

const ENV_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;
const BASE = ENV_URL ? `${ENV_URL.replace(/\/$/, '')}/api` : '/api';

// ====== AUTH TOKEN STORAGE (localStorage + Authorization header) ======
// Chrome bloquea third-party cookies por default desde 2024, asi que la cookie
// httpOnly que setea el backend cross-origin no se guarda en el browser.
// Solucion: guardamos tambien el JWT en localStorage tras login, y lo enviamos
// en cada request como Authorization: Bearer. La cookie queda como respaldo.
const TOKEN_KEY = 'bochile_auth_token';
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage no disponible (incognito + bloqueo extremo) - ignorar
  }
}

/** Si la URL ya falla, no queremos un loop infinito de redirect cuando ya estamos en /login. */
function shouldRedirectOn401(path: string): boolean {
  if (path.startsWith('/auth/')) return false;
  if (typeof window === 'undefined') return false;
  if (window.location.pathname === '/login') return false;
  return true;
}

function handle401(path: string) {
  if (!shouldRedirectOn401(path)) return;
  // Preservar destino para volver despues del login
  const dest = window.location.pathname + window.location.search;
  const qs = dest && dest !== '/' ? `?next=${encodeURIComponent(dest)}` : '';
  window.location.replace(`/login${qs}`);
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  // Inyectar Authorization: Bearer si hay token guardado.
  const token = getAuthToken();
  const baseHeaders = init.headers ? { ...(init.headers as Record<string, string>) } : {};
  if (token && !baseHeaders['Authorization']) {
    baseHeaders['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: baseHeaders,
  });
  if (res.status === 401) {
    // 401 -> token invalido o expirado -> limpiar storage
    setAuthToken(null);
    handle401(path);
  }
  return res;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await rawFetch(path, { method: 'GET' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await rawFetch(path, {
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

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await rawFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

// ====== AUTH TYPES ======
export interface AuthUser {
  email: string;
  nombre: string;
  rol: string;
}

export const api = {
  health: () => getJson<{ status: string }>(`/health`),
  leads: () => getJson<import('@/types/domain').Lead[]>(`/leads`),
  updateLead: (lead_id: string, patch: Partial<import('@/types/domain').Lead>) =>
    patchJson<import('@/types/domain').Lead>(`/leads/${encodeURIComponent(lead_id)}`, patch),
  propiedades: () => getJson<import('@/types/domain').Propiedad[]>(`/propiedades`),
  visitas: () => getJson<import('@/types/domain').Visita[]>(`/visitas`),
  createVisita: (v: Partial<import('@/types/domain').Visita>) =>
    postJson<import('@/types/domain').Visita>(`/visitas`, v),
  updateVisita: (visita_id: string, patch: Partial<import('@/types/domain').Visita>) =>
    patchJson<import('@/types/domain').Visita>(`/visitas/${encodeURIComponent(visita_id)}`, patch),
  contratos: () => getJson<import('@/types/domain').Contrato[]>(`/contratos`),
  empleados: () => getJson<import('@/types/domain').Empleado[]>(`/empleados`),
  updateEmpleado: (empleado_id: string, patch: Partial<import('@/types/domain').Empleado>) =>
    patchJson<import('@/types/domain').Empleado>(`/empleados/${encodeURIComponent(empleado_id)}`, patch),
  matches: () => getJson<import('@/types/domain').MatchPendiente[]>(`/matches`),
  conversaciones: () => getJson<import('@/types/domain').Conversacion[]>(`/conversaciones`),
  acciones: () => getJson<import('@/types/domain').AccionIA[]>(`/acciones`),
  metrics: () => getJson<import('@/types/domain').Metrics>(`/metrics`),
  calidadIa: () => getJson<CalidadIaAudit>(`/calidad-ia/audit`),
  // ====== AUTH ======
  authMe: () => getJson<{ user: AuthUser }>(`/auth/me`),
  authLogin: async (email: string, password: string) => {
    const res = await postJson<{ user: AuthUser; token?: string }>(`/auth/login`, { email, password });
    if (res?.token) setAuthToken(res.token);
    return res;
  },
  authLogout: async () => {
    setAuthToken(null);
    return postJson<{ ok: boolean }>(`/auth/logout`, {});
  },
};

// ====== CALIDAD IA TYPES ======
export interface CalidadIaIssue {
  type: 'rule_zero_violation' | 'premature_pivot' | 'tech_leak' | 'weak_decline' | 'context_loss';
  severity: 'critical' | 'warning' | 'info';
  lead_id: string;
  nombre: string;
  telefono: string;
  timestamp: string;
  snippet: string;
  full_message?: string;
  context_before?: string;
  recomendacion: string;
}

export interface CalidadIaKpis {
  total_mensajes: number;
  total_leads: number;
  mensajes_in: number;
  mensajes_out: number;
  fails_totales: number;
  fails_criticos: number;
  fails_warning: number;
  fails_info: number;
  fail_rate_pct: number;
  tasa_humano_pct: number;
  ultima_actualizacion: string;
}

export interface CalidadIaAudit {
  kpis: CalidadIaKpis;
  issues_by_type: Record<string, number>;
  issues: CalidadIaIssue[];
  total_issues: number;
}
