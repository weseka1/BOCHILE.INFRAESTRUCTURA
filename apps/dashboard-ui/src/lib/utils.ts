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

export function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
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
