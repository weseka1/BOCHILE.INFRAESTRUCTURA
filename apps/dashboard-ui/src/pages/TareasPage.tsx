import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ListTodo, Lightbulb,
  Plus, Trash2, AlertTriangle, CheckSquare, Square,
  X, ChevronRight, Clock, Loader2, Megaphone, Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTareas, type TareaPrioridad, type TareaEstado } from '@/hooks/useTareas';
import { usePuntosMejora, type PuntoMejora } from '@/hooks/useMarketingLocal';
import { MARKETING_ASIGNADO_ID } from '@/pages/DashboardPage';
import { cn } from '@/lib/utils';

const prioDot: Record<TareaPrioridad, string> = {
  alta: 'bg-rose-400',
  media: 'bg-amber-400',
  baja: 'bg-emerald-400',
};
const prioStyles: Record<PuntoMejora['prioridad'], string> = {
  alta: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  media: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  baja: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};
const estadoStyles: Record<PuntoMejora['estado'], string> = {
  abierto: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  en_progreso: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  resuelto: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

function parseDateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  if (s.includes('T')) return new Date(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * /tareas — Panel pragmatico del equipo Bochile.
 * Solo gestion de tareas internas + puntos a mejorar.
 * (Removidos: hero con cierres, objetivos por area, leaderboard. Las metricas
 * comerciales no se mostraban en el flujo diario de la operadora y agregaban
 * ruido. Quedan en /empleados y /inicio si hace falta.)
 */
export function TareasPage() {
  const { tareas, crear: crearTarea, actualizar: actualizarTarea, eliminar: eliminarTarea } = useTareas();
  const { puntos, crear: crearPunto, actualizar: actualizarPunto, eliminar: eliminarPunto } = usePuntosMejora();

  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Tareas del equipo Bochile (excluyo derivadas a Weseka)
  const tareasBochile = useMemo(
    () => tareas.filter(t => t.asignado_a !== MARKETING_ASIGNADO_ID),
    [tareas],
  );

  // Tareas con vencimiento HOY o vencidas. Pendientes arriba (accionables);
  // completadas-hoy abajo (con linea cruzada) hasta fin del dia.
  const tareasDelDiaTodas = useMemo(() => {
    return tareasBochile.filter(t => {
      if (!t.vencimiento) return false;
      const d = parseDateLocal(t.vencimiento);
      if (!d) return false;
      if (t.estado !== 'completada') return d.getTime() === hoy.getTime() || d < hoy;
      const completadaHoy = !!t.completada_en && parseDateLocal(t.completada_en.slice(0, 10))?.getTime() === hoy.getTime();
      return completadaHoy;
    }).sort((a, b) => {
      const aDone = a.estado === 'completada' ? 1 : 0;
      const bDone = b.estado === 'completada' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const da = parseDateLocal(a.vencimiento)!.getTime();
      const db = parseDateLocal(b.vencimiento)!.getTime();
      return da - db;
    });
  }, [tareasBochile, hoy]);

  const tareasDelDia = tareasDelDiaTodas.filter(t => t.estado !== 'completada');
  const tareasDelDiaCompletadas = tareasDelDiaTodas.filter(t => t.estado === 'completada');

  const tareasSinFecha = useMemo(
    () => tareasBochile.filter(t => t.estado !== 'completada' && !t.vencimiento),
    [tareasBochile],
  );

  // Form punto a mejorar
  const [pmTitulo, setPmTitulo] = useState('');
  const [pmPrio, setPmPrio] = useState<PuntoMejora['prioridad']>('media');
  function submitPunto(e: React.FormEvent) {
    e.preventDefault();
    if (!pmTitulo.trim()) return;
    crearPunto({ titulo: pmTitulo.trim(), prioridad: pmPrio });
    setPmTitulo(''); setPmPrio('media');
  }

  // Quick add tarea HOY
  const [qTarea, setQTarea] = useState('');
  function submitQuickTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!qTarea.trim()) return;
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    crearTarea({ titulo: qTarea.trim(), prioridad: 'media', vencimiento: `${yyyy}-${mm}-${dd}` });
    setQTarea('');
  }

  // Filtro y bulk admin
  type FiltroAdmin = 'todas' | 'pendiente' | 'en_curso' | 'completada';
  const [filtroAdmin, setFiltroAdmin] = useState<FiltroAdmin>('todas');
  const [seleccionAdmin, setSeleccionAdmin] = useState<Set<string>>(new Set());

  function toggleSeleccion(id: string) {
    setSeleccionAdmin(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function seleccionarTodasVisibles(ids: string[]) {
    if (ids.length === 0) return;
    setSeleccionAdmin(prev => {
      const todasYa = ids.every(id => prev.has(id));
      if (todasYa) {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }
  function moverSeleccionadasAWeseka() {
    if (seleccionAdmin.size === 0) return;
    const ids = Array.from(seleccionAdmin);
    if (!window.confirm(`Mover ${ids.length} tarea${ids.length > 1 ? 's' : ''} al panel WESEKA.IA?\n\nVan a salir de Bochile y aparecer en /marketing.`)) return;
    Promise.all(ids.map(id => actualizarTarea(id, { asignado_a: MARKETING_ASIGNADO_ID })))
      .then(() => setSeleccionAdmin(new Set()));
  }
  function eliminarSeleccionadas() {
    if (seleccionAdmin.size === 0) return;
    const ids = Array.from(seleccionAdmin);
    if (!window.confirm(`Eliminar ${ids.length} tarea${ids.length > 1 ? 's' : ''}?\n\nNo se puede deshacer.`)) return;
    Promise.all(ids.map(id => eliminarTarea(id)))
      .then(() => setSeleccionAdmin(new Set()));
  }

  const tareasAdmin = useMemo(() => {
    const baseBochile = tareasBochile.filter(t => t.asignado_a !== MARKETING_ASIGNADO_ID);
    const list = filtroAdmin === 'todas'
      ? baseBochile
      : baseBochile.filter(t => t.estado === filtroAdmin);
    const ordenPrio: Record<TareaPrioridad, number> = { alta: 0, media: 1, baja: 2 };
    return [...list].sort((a, b) => {
      if (a.estado === 'completada' && b.estado !== 'completada') return 1;
      if (a.estado !== 'completada' && b.estado === 'completada') return -1;
      const p = ordenPrio[a.prioridad] - ordenPrio[b.prioridad];
      if (p !== 0) return p;
      return (b.creada_en || '').localeCompare(a.creada_en || '');
    });
  }, [tareasBochile, filtroAdmin]);

  const countsAdmin = useMemo(() => {
    const bb = tareasBochile.filter(t => t.asignado_a !== MARKETING_ASIGNADO_ID);
    return {
      todas: bb.length,
      pendiente: bb.filter(t => t.estado === 'pendiente').length,
      en_curso: bb.filter(t => t.estado === 'en_curso').length,
      completada: bb.filter(t => t.estado === 'completada').length,
    };
  }, [tareasBochile]);

  return (
    <>
      {/* ========================== TAREAS DEL DIA ========================== */}
      <Card className="mb-6 border-accent/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/15 text-accent"><ListTodo className="w-4 h-4" /></div>
            <h3 className="font-display text-base font-semibold text-text">Tareas internas del equipo</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
              {tareasDelDia.length}
            </span>
          </div>
          <a href="#todas" className="text-xs text-accent hover:underline flex items-center gap-1" title="Ver y administrar todas las tareas internas">
            Todas <ChevronRight className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[10px] text-text-subtle mb-2">
          Visitas, llamados, recordatorios — lo que sea del dia para el equipo Bochile.
        </p>

        <form onSubmit={submitQuickTarea} className="flex gap-2 mb-3">
          <input
            value={qTarea}
            onChange={e => setQTarea(e.target.value)}
            placeholder="Tarea interna del equipo (Enter)..."
            className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
          />
          <button
            type="submit" disabled={!qTarea.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Agregar tarea interna"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>

        {tareasDelDia.length === 0 && tareasDelDiaCompletadas.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Sin tareas con vencimiento para hoy.</p>
            {tareasSinFecha.length > 0 && (
              <p className="text-[10px] mt-1 text-text-subtle">
                Hay {tareasSinFecha.length} sin fecha. <a href="#todas" className="underline">Vér todas abajo</a>
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-1">
            {/* Pendientes + En curso (en una sola lista, con select inline) */}
            {tareasDelDia.length > 0 && (
              <ul className="space-y-1.5">
                {tareasDelDia.map(t => {
                  const d = parseDateLocal(t.vencimiento);
                  const vencida = d ? d < hoy : false;
                  return (
                    <li key={t.id} className={cn(
                      'flex items-center gap-2 p-2 rounded-md border transition-colors group',
                      vencida ? 'border-rose-500/30 bg-rose-500/5'
                      : t.estado === 'en_curso' ? 'border-blue-500/40 bg-blue-500/5'
                      : 'border-border bg-surface-1 hover:border-accent/40',
                    )}>
                      <span className={cn('w-2 h-2 rounded-full shrink-0', prioDot[t.prioridad])} title={`prioridad ${t.prioridad}`} />
                      <span className="text-sm text-text flex-1 min-w-0 break-words">{t.titulo}</span>
                      {vencida && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-300 font-semibold shrink-0">
                          <AlertTriangle className="w-3 h-3" /> VENC
                        </span>
                      )}
                      {/* Select inline de estado - click directo, sin window.confirm */}
                      <select
                        value={t.estado}
                        onChange={e => {
                          const next = e.target.value as TareaEstado;
                          actualizarTarea(t.id, {
                            estado: next,
                            completada_en: next === 'completada' ? new Date().toISOString() : '',
                          });
                        }}
                        className={cn(
                          'shrink-0 text-[11px] rounded-md px-1.5 py-0.5 border outline-none cursor-pointer font-semibold',
                          t.estado === 'pendiente' && 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
                          t.estado === 'en_curso' && 'bg-blue-500/15 text-blue-300 border-blue-500/30',
                          t.estado === 'completada' && 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                        )}
                        aria-label="Cambiar estado"
                        title="Cambiar estado"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_curso">En curso</option>
                        <option value="completada">Realizado</option>
                      </select>
                      {/* Derivar a WSK - 1 click sin confirmacion */}
                      <button
                        type="button"
                        onClick={() => actualizarTarea(t.id, { asignado_a: MARKETING_ASIGNADO_ID })}
                        className="shrink-0 p-1 rounded text-fuchsia-300 hover:bg-fuchsia-500/15 sm:opacity-0 group-hover:opacity-100 transition-all"
                        title="Derivar a WESEKA.IA"
                        aria-label="Derivar a WSK"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                      </button>
                      {/* Eliminar - SI lleva confirmacion (destructivo) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Eliminar esta tarea?\n\n"${t.titulo}"\n\nNo se puede deshacer.`)) {
                            eliminarTarea(t.id);
                          }
                        }}
                        className="shrink-0 p-1 rounded text-text-muted hover:text-rose-300 hover:bg-rose-500/10 sm:opacity-0 group-hover:opacity-100 transition-all"
                        title="Eliminar"
                        aria-label="Eliminar tarea"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* Realizadas hoy (separadas abajo con linea cruzada) */}
            {tareasDelDiaCompletadas.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-text-subtle mt-4 mb-2 flex items-center gap-1.5">
                  <CheckSquare className="w-3 h-3 text-emerald-400" /> Realizadas hoy · {tareasDelDiaCompletadas.length}
                </p>
                <ul className="space-y-1">
                  {tareasDelDiaCompletadas.map(t => (
                    <li key={t.id} className="flex items-center gap-2 p-1.5 rounded-md opacity-60 hover:opacity-90 transition-opacity group">
                      <span className="text-sm flex-1 min-w-0 break-words line-through text-text-muted">{t.titulo}</span>
                      {/* Select inline tambien aqui — permite reabrir 1-click */}
                      <select
                        value={t.estado}
                        onChange={e => {
                          const next = e.target.value as TareaEstado;
                          actualizarTarea(t.id, {
                            estado: next,
                            completada_en: next === 'completada' ? new Date().toISOString() : '',
                          });
                        }}
                        className={cn(
                          'shrink-0 text-[11px] rounded-md px-1.5 py-0.5 border outline-none cursor-pointer font-semibold',
                          'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                        )}
                        aria-label="Cambiar estado"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_curso">En curso</option>
                        <option value="completada">Realizado</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Eliminar esta tarea?\n\n"${t.titulo}"\n\nNo se puede deshacer.`)) {
                            eliminarTarea(t.id);
                          }
                        }}
                        className="shrink-0 p-1 rounded text-text-muted hover:text-rose-300 hover:bg-rose-500/10 sm:opacity-0 group-hover:opacity-100 transition-all"
                        title="Eliminar tarea"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ========================== PUNTOS A MEJORAR ========================== */}
      <Card className="mb-6 border-accent/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/15 text-accent"><Lightbulb className="w-4 h-4" /></div>
            <h3 className="font-display text-base font-semibold text-text">Puntos a mejorar del equipo</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
              {puntos.filter(p => p.estado !== 'resuelto').length} abiertos
            </span>
          </div>
          <span className="text-[11px] text-text-subtle hidden sm:inline">Hablen entre ustedes lo que cuesta · anótenlo · resuélvanlo juntos</span>
        </div>

        <form onSubmit={submitPunto} className="grid grid-cols-12 gap-2 mb-3">
          <input
            value={pmTitulo}
            onChange={e => setPmTitulo(e.target.value)}
            placeholder="Ej. Mejorar tiempo de respuesta en alquileres"
            className="col-span-12 sm:col-span-8 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
          />
          <select
            value={pmPrio}
            onChange={e => setPmPrio(e.target.value as PuntoMejora['prioridad'])}
            className="col-span-7 sm:col-span-2 bg-surface-2 border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-accent text-text"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <button
            type="submit" disabled={!pmTitulo.trim()}
            className="col-span-5 sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </form>

        {puntos.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Anotá puntos a mejorar del equipo o del proceso.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {puntos.map(p => (
              <li key={p.id} className={cn(
                'flex items-start gap-2 p-3 rounded-lg border transition-colors',
                p.estado === 'resuelto' ? 'border-emerald-500/30 bg-emerald-500/5 opacity-70' : 'border-border bg-surface-1 hover:border-accent/40',
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-sm font-medium break-words', p.estado === 'resuelto' && 'line-through text-text-muted')}>
                      {p.titulo}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className={cn('border', prioStyles[p.prioridad])}>{p.prioridad}</Badge>
                    <select
                      value={p.estado}
                      onChange={e => actualizarPunto(p.id, { estado: e.target.value as PuntoMejora['estado'] })}
                      className={cn('text-[11px] rounded-md px-1.5 py-0.5 border outline-none cursor-pointer', estadoStyles[p.estado])}
                    >
                      <option value="abierto">Abierto</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="resuelto">Resuelto</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { if (window.confirm('Eliminar este punto?')) eliminarPunto(p.id); }}
                  className="shrink-0 p-1.5 text-text-muted hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ========================== ADMINISTRAR TODAS LAS TAREAS ========================== */}
      <section id="todas" className="mb-6 scroll-mt-20">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/15 text-accent"><Filter className="w-4 h-4" /></div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-text">Administrar todas las tareas</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
              {tareasAdmin.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['todas', 'pendiente', 'en_curso', 'completada'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltroAdmin(f)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all border inline-flex items-center gap-1.5',
                  filtroAdmin === f
                    ? 'bg-accent/15 text-accent border-accent/40'
                    : 'bg-surface-2 border-border text-text-muted hover:text-text',
                )}
              >
                {f === 'todas' && <ListTodo className="w-3 h-3" />}
                {f === 'pendiente' && <Clock className="w-3 h-3" />}
                {f === 'en_curso' && <Loader2 className="w-3 h-3" />}
                {f === 'completada' && <CheckSquare className="w-3 h-3" />}
                <span className="capitalize">
                  {f === 'en_curso' ? 'En curso' : f === 'completada' ? 'Realizado' : f}
                </span>
                <span className="font-mono opacity-60">{countsAdmin[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {seleccionAdmin.size > 0 && (
          <div className="mb-2 p-2.5 rounded-lg bg-accent/8 border border-accent/40 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-accent">{seleccionAdmin.size} seleccionada{seleccionAdmin.size > 1 ? 's' : ''}</span>
            <span className="text-text-subtle">·</span>
            <button
              type="button"
              onClick={moverSeleccionadasAWeseka}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/40 hover:bg-fuchsia-500/25 transition-colors"
              title="Mover las seleccionadas al panel WESEKA.IA"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Mover a WESEKA.IA
            </button>
            <button
              type="button"
              onClick={eliminarSeleccionadas}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setSeleccionAdmin(new Set())}
              className="ml-auto p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              title="Cancelar seleccion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <Card>
          {tareasAdmin.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No hay tareas {filtroAdmin !== 'todas' ? `en estado "${filtroAdmin === 'en_curso' ? 'En curso' : filtroAdmin}"` : 'todavía'}.</p>
              <p className="text-[10px] mt-1 text-text-subtle">Agregalas desde el widget de arriba con Enter.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40 px-1">
                <button
                  type="button"
                  onClick={() => seleccionarTodasVisibles(tareasAdmin.map(t => t.id))}
                  className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-accent transition-colors"
                  title="Seleccionar todas las visibles para moverlas o eliminarlas"
                >
                  {tareasAdmin.every(t => seleccionAdmin.has(t.id))
                    ? <CheckSquare className="w-3.5 h-3.5 text-accent" />
                    : <Square className="w-3.5 h-3.5" />}
                  <span>{tareasAdmin.every(t => seleccionAdmin.has(t.id)) ? 'Deseleccionar todas' : 'Seleccionar todas las visibles'}</span>
                </button>
                <span className="text-[10px] text-text-subtle">
                  {tareasAdmin.length} tarea{tareasAdmin.length === 1 ? '' : 's'} en este filtro
                </span>
              </div>
              <ul className="space-y-1.5">
              {tareasAdmin.map(t => {
                const d = parseDateLocal(t.vencimiento);
                const vencida = d ? d < hoy && t.estado !== 'completada' : false;
                const completed = t.estado === 'completada';
                const seleccionada = seleccionAdmin.has(t.id);
                return (
                  <li key={t.id} className={cn(
                    'flex items-center gap-2 sm:gap-3 p-2.5 rounded-md border transition-colors group',
                    seleccionada ? 'border-accent/60 bg-accent/5'
                    : completed ? 'border-border/40 bg-surface-1/40 opacity-70'
                    : vencida ? 'border-rose-500/30 bg-rose-500/5'
                    : 'border-border bg-surface-1 hover:border-accent/40',
                  )}>
                    <button
                      type="button"
                      onClick={() => toggleSeleccion(t.id)}
                      className="shrink-0 text-text-muted hover:text-accent transition-colors"
                      aria-label={seleccionada ? 'Deseleccionar' : 'Seleccionar'}
                      title="Seleccionar para mover a WESEKA o eliminar en lote"
                    >
                      {seleccionada
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : <Square className="w-4 h-4" />}
                    </button>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', prioDot[t.prioridad])} title={`prioridad ${t.prioridad}`} />
                    <span className={cn('text-sm flex-1 min-w-0 break-words', completed && 'line-through text-text-muted')}>
                      {t.titulo}
                    </span>
                    {vencida && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-300 font-semibold shrink-0">
                        <AlertTriangle className="w-3 h-3" /> VENC
                      </span>
                    )}
                    {t.vencimiento && (
                      <span className="text-[10px] text-text-subtle font-mono shrink-0 hidden sm:inline">
                        {(d || new Date()).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    <select
                      value={t.estado}
                      onChange={e => {
                        const next = e.target.value as TareaEstado;
                        actualizarTarea(t.id, {
                          estado: next,
                          completada_en: next === 'completada' ? new Date().toISOString() : '',
                        });
                      }}
                      className={cn(
                        'shrink-0 text-[11px] rounded-md px-1.5 py-0.5 border outline-none cursor-pointer font-semibold',
                        t.estado === 'pendiente' && 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
                        t.estado === 'en_curso' && 'bg-blue-500/15 text-blue-300 border-blue-500/30',
                        t.estado === 'completada' && 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                      )}
                      aria-label="Cambiar estado"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_curso">En curso</option>
                      <option value="completada">Realizado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => actualizarTarea(t.id, { asignado_a: MARKETING_ASIGNADO_ID })}
                      className="shrink-0 p-1 rounded text-fuchsia-300 hover:bg-fuchsia-500/15 sm:opacity-0 group-hover:opacity-100 transition-all"
                      title="Derivar al equipo WESEKA.IA"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Eliminar esta tarea?\n\n"${t.titulo}"\n\nEsta accion no se puede deshacer.`)) {
                          eliminarTarea(t.id);
                        }
                      }}
                      className="shrink-0 p-1 rounded text-text-muted hover:text-rose-300 hover:bg-rose-500/10 sm:opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar tarea"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
              </ul>
            </>
          )}
        </Card>
      </section>

      <div className="mt-6 text-[11px] text-text-subtle text-center">
        Tareas del equipo Bochile · derivá lo que sea WSK con el botón <Megaphone className="w-3 h-3 inline text-fuchsia-300" /> y aparecerá en <Link to="/marketing" className="text-accent hover:underline">WESEKA.IA</Link>
      </div>
    </>
  );
}
