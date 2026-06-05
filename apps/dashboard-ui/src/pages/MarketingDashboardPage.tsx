import { useMemo, useState } from 'react';
import {
  Megaphone, Plus, Trash2, AlertTriangle, CheckSquare, Square,
  Inbox, ArrowLeftRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { useTareas, type TareaPrioridad } from '@/hooks/useTareas';
import { cn } from '@/lib/utils';
import { MARKETING_ASIGNADO_ID } from '@/pages/DashboardPage';

const prioDot: Record<TareaPrioridad, string> = {
  alta: 'bg-rose-400',
  media: 'bg-amber-400',
  baja: 'bg-emerald-400',
};

function parseDateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  if (s.includes('T')) return new Date(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Panel chico INTERNO de WSK (equipo de Marketing).
 * - Recibe las tareas que el equipo Bochile DERIVA desde su panel.
 * - Permite anotar tareas propias del equipo de marketing.
 * - "Devolver a Bochile" deshace la derivacion (asignado_a -> Sin asignar).
 *
 * No duplica datos: usa el mismo store de tareas (Google Sheets via /api/tareas).
 * El sentinela MARKETING_ASIGNADO_ID en el campo asignado_a separa cada bandeja.
 */
export function MarketingDashboardPage() {
  const { tareas, crear, actualizar, eliminar } = useTareas();
  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const tareasMarketing = useMemo(
    () => tareas
      .filter(t => t.asignado_a === MARKETING_ASIGNADO_ID && t.estado !== 'completada')
      .sort((a, b) => (b.creada_en || '').localeCompare(a.creada_en || '')),
    [tareas],
  );

  const completadas = useMemo(
    () => tareas
      .filter(t => t.asignado_a === MARKETING_ASIGNADO_ID && t.estado === 'completada')
      .sort((a, b) => (b.completada_en || '').localeCompare(a.completada_en || ''))
      .slice(0, 10),
    [tareas],
  );

  const vencidas = tareasMarketing.filter(t => {
    if (!t.vencimiento) return false;
    const d = parseDateLocal(t.vencimiento);
    return d ? d < hoy : false;
  }).length;

  const [qTitulo, setQTitulo] = useState('');
  const [qPrio, setQPrio] = useState<TareaPrioridad>('media');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!qTitulo.trim()) return;
    crear({ titulo: qTitulo.trim(), prioridad: qPrio, asignado_a: MARKETING_ASIGNADO_ID });
    setQTitulo('');
  }

  return (
    <>
      <PageHeader
        title="Panel Marketing"
        subtitle="Bandeja interna WSK · tareas derivadas desde Bochile + tareas propias"
      />

      {/* Hero compacto */}
      <div className="relative mb-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 via-surface-1 to-purple-500/5 border border-fuchsia-500/30 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-fuchsia-500 text-white shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)]">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-text">Bandeja Marketing</h2>
            <p className="text-xs text-text-muted">
              {tareasMarketing.length} pendiente{tareasMarketing.length === 1 ? '' : 's'}
              {vencidas > 0 && <span className="text-rose-300 font-semibold"> · {vencidas} vencida{vencidas > 1 ? 's' : ''}</span>}
              {' · '}{completadas.length} completada{completadas.length === 1 ? '' : 's'} reciente{completadas.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick-add tarea propia WSK */}
      <Card className="mb-4 border-fuchsia-500/30">
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <input
            value={qTitulo}
            onChange={e => setQTitulo(e.target.value)}
            placeholder="Anotá una tarea de marketing y presioná Enter..."
            className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400 text-text placeholder:text-text-muted"
          />
          <div className="flex items-center gap-1.5">
            {(['alta', 'media', 'baja'] as TareaPrioridad[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setQPrio(p)}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all border',
                  qPrio === p
                    ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40'
                    : 'bg-surface-2 border-border text-text-muted hover:text-text',
                )}
              >{p}</button>
            ))}
            <button
              type="submit" disabled={!qTitulo.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-fuchsia-500 text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
        </form>
      </Card>

      {/* Bandeja principal */}
      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-fuchsia-300" />
          <h3 className="font-display text-sm font-semibold text-text">Bandeja</h3>
        </div>

        {tareasMarketing.length === 0 ? (
          <div className="text-center py-10 text-text-muted">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Bandeja vacía.</p>
            <p className="text-[11px] mt-1 text-text-subtle">
              Bochile puede derivarte tareas con el botón <span className="text-fuchsia-300 font-semibold">Marketing</span> del Inicio.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tareasMarketing.map(t => {
              const d = parseDateLocal(t.vencimiento);
              const vencida = d ? d < hoy : false;
              return (
                <li key={t.id} className={cn(
                  'flex items-center gap-2 p-2.5 rounded-md border transition-colors group',
                  vencida ? 'border-rose-500/30 bg-rose-500/5' : 'border-border bg-surface-1 hover:border-fuchsia-500/40',
                )}>
                  <button
                    type="button"
                    onClick={() => actualizar(t.id, { estado: 'completada', completada_en: new Date().toISOString() })}
                    className="shrink-0 text-text-muted hover:text-fuchsia-300 transition-colors"
                    aria-label="Completar"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <span className={cn('w-2 h-2 rounded-full shrink-0', prioDot[t.prioridad])} />
                  <span className="text-sm text-text flex-1 min-w-0 break-words">{t.titulo}</span>
                  {t.vencimiento && (
                    <span className={cn('text-[10px] shrink-0', vencida ? 'text-rose-300 font-semibold' : 'text-text-muted')}>
                      {vencida && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                      {(d || new Date()).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => actualizar(t.id, { asignado_a: '' })}
                    className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors opacity-0 group-hover:opacity-100 inline-flex items-center gap-1"
                    title="Devolver esta tarea al equipo Bochile"
                  >
                    <ArrowLeftRight className="w-3 h-3" /> Devolver
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm('Eliminar tarea?')) eliminar(t.id); }}
                    className="shrink-0 p-1 text-text-muted hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Completadas recientes (collapsible visual sutil) */}
      {completadas.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="w-4 h-4 text-emerald-300" />
            <h3 className="font-display text-sm font-semibold text-text">Completadas recientes</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
              {completadas.length}
            </span>
          </div>
          <ul className="space-y-1">
            {completadas.map(t => (
              <li key={t.id} className="flex items-center gap-2 p-1.5 rounded-md text-text-muted text-sm">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="line-through truncate flex-1">{t.titulo}</span>
                {t.completada_en && (
                  <span className="text-[10px] text-text-subtle shrink-0">
                    {new Date(t.completada_en).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 text-[11px] text-text-subtle text-center">
        Panel interno WSK · las tareas se sincronizan con el mismo store que ve Bochile
      </div>
    </>
  );
}
