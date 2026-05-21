import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency = 'USD'): string {
  if (!value && value !== 0) return '-';
  if (currency === 'USD') return `USD ${value.toLocaleString('es-AR')}`;
  if (currency === 'ARS') return `$ ${value.toLocaleString('es-AR')}`;
  return `${currency} ${value.toLocaleString('es-AR')}`;
}

// Sheets serial: dias desde 1899-12-30 (Sheets cree erroneamente que 1900 es bisiesto)
// Offset correcto a Unix epoch (1970-01-01) = 25569 dias + corregimos off-by-one
function sheetsSerialToDate(serial: number): Date {
  // Para serials > 60 (despues del bug fantasma 1900-02-29 de Excel), usar 25569.
  // Para fechas modernas (>60), restamos 25569 (NO 25568) -- ajuste segun prueba real:
  // 2026-05-22 corresponde a serial 46164. (46164 - 25569) = 20595 dias.
  // 1970-01-01 + 20595 dias = 2026-05-21 23:00 UTC. En AR (UTC-3) sigue siendo 21.
  // Necesitamos +1 dia para corregir TZ + bug Sheets. Usamos UTC noon para evitar TZ shifts.
  const days = serial - 25569;
  const ms = days * 86400 * 1000 + 12 * 3600 * 1000; // noon UTC
  return new Date(ms);
}

export function formatDate(iso: string | number): string {
  if (iso === '' || iso === null || iso === undefined) return '-';
  if (typeof iso === 'number') {
    if (iso < 1) return '-';
    const d = sheetsSerialToDate(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
  }
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

// Para visitas: "Viernes 22 de mayo" (sin año, capitalizado)
export function formatFechaVisita(v: string | number): string {
  if (v === '' || v === null || v === undefined) return '-';
  let d: Date;
  if (typeof v === 'number') {
    if (v < 1) return '-';
    d = sheetsSerialToDate(v);
  } else {
    const s = String(v).trim();
    // Si viene "YYYY-MM-DD" forzar UTC noon para no perder dia por TZ
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(s + 'T12:00:00Z');
    } else {
      d = new Date(s);
    }
  }
  if (isNaN(d.getTime())) return String(v);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' };
  const s = d.toLocaleDateString('es-AR', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Para hora: convierte 0.4583... (Sheets serial) a "11:00"
export function formatHora(v: string | number): string {
  if (v === '' || v === null || v === undefined) return '-';
  if (typeof v === 'number') {
    const totalMin = Math.round(v * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  const s = String(v).trim();
  // Si ya viene "HH:MM" o "HH:MM:SS", devolverlo recortado
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return m[1].padStart(2, '0') + ':' + m[2];
  // Si es numero como string
  const n = Number(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    const totalMin = Math.round(n * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const min = totalMin % 60;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }
  return s;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `hace ${days}d`;
  return formatDate(iso);
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400 bg-emerald-500/10';
  if (score >= 40) return 'text-amber-400 bg-amber-500/10';
  return 'text-rose-400 bg-rose-500/10';
}

export function etapaColor(etapa: string): string {
  const map: Record<string, string> = {
    'Nuevo': 'bg-blue-500/10 text-blue-300',
    'Calificado IA': 'bg-purple-500/10 text-purple-300',
    'Visita agendada': 'bg-emerald-500/10 text-emerald-300',
    'En espera de stock': 'bg-amber-500/10 text-amber-300',
    'Negociación': 'bg-pink-500/10 text-pink-300',
    'Cerrado': 'bg-zinc-500/10 text-zinc-300',
  };
  return map[etapa] ?? 'bg-zinc-500/10 text-zinc-300';
}
