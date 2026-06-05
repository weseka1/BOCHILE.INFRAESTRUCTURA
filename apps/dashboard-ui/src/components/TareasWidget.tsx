import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Square, Plus, AlertTriangle, ArrowUpRight, ListTodo } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useTareas, type TareaPrioridad } from '@/hooks/useTareas';
import { cn } from '@/lib/utils';

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
 * Widget pragmatico de Tareas para el Inicio.
 * - Muestra las pendientes (vencidas primero)
 * - Quick-add inline (Enter crea con prioridad media)
 * - Tick rapido para completar
 */
export function TareasWidget({ limit = 5 }: { limit?: number }) {
  const { tareas, crear, actualizar } = useTareas();
  const [quick, setQuick] = useState('');

  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const pendientes = useMemo(() => {
    const list = tareas.filter(t => t.estado !== 'completada');
    const orden: Record<TareaPrioridad, number> = { alta: 0, media: 1, baja: 2 };
    return [...list].sort((a, b) => {
      const da = parseDateLocal(a.vencimiento);
      const db = parseDateLocal(b.vencimiento);
      const av = da && da < hoy ? 0 : 1;
      const bv = db && db < hoy ? 0 : 1;
      if (av !== bv) return av - bv;
      const p = orden[a.prioridad] - orden[b.prioridad];
      if (p !== 0) return p;
      return (b.creada_en || '').localeCompare(a.creada_en || '');
    });
  }, [tareas, hoy]);

  const vencidas = pendientes.filter(t => {
    const d = parseDateLocal(t.vencimiento);
    return d ? d < hoy : false;
  }).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = quick.trim();
    if (!t) return;
    crear({ titulo: t, prioridad: 'media' });
    setQuick('');
  }

  return (
    <Card className="border-accent/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
            <ListTodo className="w-4 h-4" />
          </div>
          <h3 className="font-display text-base font-semibold text-text">Tareas pendientes</h3>
          {vencidas > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-3 h-3" /> {vencidas} vencida{vencidas > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Link to="/tareas" className="text-xs text-accent hover:underline flex items-center gap-1">
          Ver todas <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {/* QUICK ADD */}
      <form onSubmit={submit} className="flex gap-2 mb-3">
        <input
          value={quick}
          onChange={e => setQuick(e.target.value)}
          placeholder="Anotar tarea rapida y presionar Enter..."
          className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={!quick.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Agregar tarea"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>

      {pendientes.length === 0 ? (
        <div className="text-center py-6 text-text-muted">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Sin pendientes. Buen trabajo.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {pendientes.slice(0, limit).map(t => {
            const d = parseDateLocal(t.vencimiento);
            const vencida = d ? d < hoy : false;
            return (
              <li
                key={t.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-md border transition-colors',
                  vencida ? 'border-rose-500/30 bg-rose-500/5' : 'border-border bg-surface-1 hover:border-accent/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => actualizar(t.id, { estado: 'completada', completada_en: new Date().toISOString() })}
                  className="shrink-0 text-text-muted hover:text-accent transition-colors"
                  aria-label="Completar"
                >
                  <Square className="w-4 h-4" />
                </button>
                <span className={cn('w-2 h-2 rounded-full shrink-0', prioDot[t.prioridad])} />
                <span className="text-sm text-text flex-1 min-w-0 truncate">{t.titulo}</span>
                {t.vencimiento && (
                  <span className={cn('text-[10px] shrink-0', vencida ? 'text-rose-300 font-semibold' : 'text-text-muted')}>
                    {(d || new Date()).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </li>
            );
          })}
          {pendientes.length > limit && (
            <li className="text-center pt-1">
              <Link to="/tareas" className="text-[11px] text-text-muted hover:text-accent">
                + {pendientes.length - limit} mas
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
