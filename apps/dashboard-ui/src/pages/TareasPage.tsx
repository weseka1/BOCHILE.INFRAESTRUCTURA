import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, ListTodo, Lightbulb, Sparkles, Calendar, MessageSquare,
  Plus, Trash2, AlertTriangle, CheckSquare, Square,
  Trophy, Medal, Award,
  Building2, Key, UserPlus, ArrowUpRight, ExternalLink,
  X, ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTareas, type TareaPrioridad } from '@/hooks/useTareas';
import { useEmpleados } from '@/hooks/useEmpleados';
import { useMetrics } from '@/hooks/useMetrics';
import { useObjetivosMes, usePuntosMejora, type PuntoMejora, type ObjetivoCategoria } from '@/hooks/useMarketingLocal';
import { MARKETING_ASIGNADO_ID } from '@/pages/DashboardPage';
import type { Empleado } from '@/types/domain';
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

const CATEGORIAS: { key: ObjetivoCategoria; label: string; icon: any; accent: string; ring: string; iconBg: string; bar: string }[] = [
  { key: 'ventas',     label: 'Ventas',     icon: Building2, accent: 'text-emerald-300', ring: 'border-emerald-500/30 hover:border-emerald-500/60', iconBg: 'bg-emerald-500/10 text-emerald-300', bar: 'bg-emerald-400' },
  { key: 'alquileres', label: 'Alquileres', icon: Key,       accent: 'text-blue-300',    ring: 'border-blue-500/30 hover:border-blue-500/60',       iconBg: 'bg-blue-500/10 text-blue-300',       bar: 'bg-blue-400' },
  { key: 'captacion',  label: 'Captacion',  icon: UserPlus,  accent: 'text-fuchsia-300', ring: 'border-fuchsia-500/30 hover:border-fuchsia-500/60', iconBg: 'bg-fuchsia-500/10 text-fuchsia-300', bar: 'bg-fuchsia-400' },
];

function parseDateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  if (s.includes('T')) return new Date(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * /tareas - Panel del equipo Bochile.
 * Hero motivacional + Objetivos por area + Leaderboard + Tareas del dia + Puntos a mejorar.
 * Las "tareas escritas" (la lista plana de administracion) viven en el panel WESEKA.IA.
 *
 * Accesibilidad:
 * - Cards de categoria son <button> con focus-visible para teclado.
 * - Filas del leaderboard son <Link> al perfil del empleado.
 * - Modal de objetivo por categoria al hacer click en la card.
 */
export function TareasPage() {
  const { data: metrics } = useMetrics();
  const { data: empleados = [] } = useEmpleados();
  const { tareas, crear: crearTarea, actualizar: actualizarTarea } = useTareas();
  const { objetivos, crear: crearObjetivo, actualizar: actualizarObjetivo, eliminar: eliminarObjetivo } = useObjetivosMes();
  const { puntos, crear: crearPunto, actualizar: actualizarPunto, eliminar: eliminarPunto } = usePuntosMejora();

  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Equipo activo + leaderboard
  const topEquipo = useMemo(() => {
    return [...empleados]
      .filter((e: Empleado) => e.activo !== false)
      .map((e: Empleado) => ({ e, score: (e.cierres_mes || 0) * 3 + (e.visitas_mes || 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [empleados]);

  const totales = useMemo(() => {
    const cierres = empleados.reduce((s, e) => s + (e.cierres_mes || 0), 0);
    const visitas = empleados.reduce((s, e) => s + (e.visitas_mes || 0), 0);
    return { cierres, visitas };
  }, [empleados]);

  // Tareas del equipo Bochile (excluyo derivadas a Weseka)
  const tareasBochile = useMemo(
    () => tareas.filter(t => t.asignado_a !== MARKETING_ASIGNADO_ID),
    [tareas],
  );

  const tareasDelDia = useMemo(() => {
    return tareasBochile.filter(t => {
      if (t.estado === 'completada') return false;
      if (!t.vencimiento) return false;
      const d = parseDateLocal(t.vencimiento);
      if (!d) return false;
      return d.getTime() === hoy.getTime() || d < hoy;
    }).sort((a, b) => {
      const da = parseDateLocal(a.vencimiento)!.getTime();
      const db = parseDateLocal(b.vencimiento)!.getTime();
      return da - db;
    });
  }, [tareasBochile, hoy]);

  const tareasSinFecha = useMemo(
    () => tareasBochile.filter(t => t.estado !== 'completada' && !t.vencimiento),
    [tareasBochile],
  );

  // Objetivos por categoria
  const objetivosPorCat = useMemo(() => {
    const map: Record<ObjetivoCategoria, typeof objetivos> = { ventas: [], alquileres: [], captacion: [], general: [] };
    for (const o of objetivos) (map[o.categoria || 'general'] ||= []).push(o);
    return map;
  }, [objetivos]);

  // Form objetivo (en modal por categoria)
  const [modalCat, setModalCat] = useState<ObjetivoCategoria | null>(null);
  const [objTitulo, setObjTitulo] = useState('');
  const [objMeta, setObjMeta] = useState('');
  const [objUnidad, setObjUnidad] = useState('ventas');
  function submitObjetivo(e: React.FormEvent) {
    e.preventDefault();
    if (!objTitulo.trim() || !objMeta || !modalCat) return;
    crearObjetivo({ titulo: objTitulo.trim(), meta: Number(objMeta), unidad: objUnidad, categoria: modalCat });
    setObjTitulo(''); setObjMeta('');
    // Cierra el modal? Mejor lo dejo abierto para seguir agregando varios.
  }
  function openCat(cat: ObjetivoCategoria) {
    setModalCat(cat);
    // Pre-set unidad segun categoria para que sea pragmatico
    setObjUnidad(cat === 'ventas' ? 'ventas' : cat === 'alquileres' ? 'alquileres' : 'clientes');
  }
  function closeModal() { setModalCat(null); setObjTitulo(''); setObjMeta(''); }

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

  const nombreMes = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const heroKpi = totales.cierres;
  const heroSubKpi = totales.visitas;
  const visitasAgendadas = metrics?.kpis.visitasAgendadas ?? 0;

  return (
    <>
      {/* ========================== HERO MOTIVACIONAL ========================== */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-surface-1 via-surface-0 to-surface-0">
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-accent/10 border border-accent/30">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] uppercase tracking-[0.22em] text-accent font-semibold">Equipo Bochile · {nombreMes}</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-text leading-tight mb-2">
                Vamos por <span className="text-accent">cada visita</span>, <br className="hidden sm:block" />
                cada llamado, <span className="text-accent">cada cierre</span>.
              </h1>
              <p className="text-sm sm:text-base text-text-muted max-w-xl">
                Lo que se mide se mejora · Lo que se anota se cumple · Lo que se revisa se gana.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/visitas" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] transition-all">
                  <Calendar className="w-3.5 h-3.5" /> Coordinar visitas pendientes
                </Link>
                <Link to="/conversaciones" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface-2 border border-border text-text hover:border-accent/50 transition-all">
                  <MessageSquare className="w-3.5 h-3.5" /> Ver mensajes en vivo
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-1">
              <span className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Cierres del mes</span>
              <div className={cn(
                'font-display font-black tracking-tight text-accent leading-none',
                'text-6xl sm:text-7xl lg:text-8xl float-soft',
                'drop-shadow-[0_0_30px_rgba(255,200,80,0.35)]',
              )}>
                {heroKpi}
              </div>
              <div className="text-xs text-text-muted">
                <span className="text-emerald-300 font-semibold">{heroSubKpi}</span> visitas concretadas · <span className="text-accent font-semibold">{visitasAgendadas}</span> agendadas
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================== OBJETIVOS POR AREA ========================== */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/15 text-accent"><Target className="w-4 h-4" /></div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-text">Objetivos de {nombreMes}</h2>
          </div>
          <span className="text-[11px] text-text-subtle">Click en una tarjeta para agregar o editar objetivos del área</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CATEGORIAS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => openCat(c.key)}
              aria-label={`Abrir objetivos de ${c.label}`}
              className={cn(
                'group relative w-full text-left rounded-xl border bg-surface-1/80 backdrop-blur-sm p-4 sm:p-5 transition-all duration-200',
                c.ring,
                'hover:-translate-y-0.5 hover:shadow-lg',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
                'active:translate-y-0 active:scale-[0.99]',
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg transition-transform group-hover:scale-110', c.iconBg)}><c.icon className="w-4 h-4" /></div>
                  <h3 className={cn('font-display text-base font-semibold', c.accent)}>{c.label}</h3>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
                  {objetivosPorCat[c.key].length}
                </span>
              </div>

              {objetivosPorCat[c.key].length === 0 ? (
                <div className="text-center py-6 text-text-muted border border-dashed border-border rounded-lg group-hover:border-current/40 transition-colors">
                  <Plus className="w-5 h-5 mx-auto mb-1 opacity-50" />
                  <span className="text-xs">Sumá un objetivo de {c.label.toLowerCase()}</span>
                </div>
              ) : (
                <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {objetivosPorCat[c.key].map(o => {
                    const pct = o.meta > 0 ? Math.min(100, Math.round((o.actual / o.meta) * 100)) : 0;
                    const done = pct >= 100;
                    const cerca = pct >= 70 && !done;
                    return (
                      <li key={o.id} className={cn(
                        'p-2.5 rounded-lg border',
                        done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-surface-2/40',
                      )}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn(
                            'shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold',
                            done ? 'bg-emerald-500/20 text-emerald-300' : c.iconBg,
                          )}>{pct}%</span>
                          <span className="text-sm text-text flex-1 min-w-0 font-medium break-words leading-tight">{o.titulo}</span>
                        </div>
                        <div className="relative w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700 ease-out', done ? 'bg-emerald-400' : c.bar)}
                            style={{ width: `${pct}%` }}
                          />
                          {cerca && (
                            <div
                              className="absolute inset-y-0 left-0 shimmer-bar rounded-full pointer-events-none"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1.5">
                          <span>{o.actual} de {o.meta} {o.unidad}</span>
                          {done && <span className="ml-auto text-emerald-300 font-semibold uppercase tracking-wider text-[10px]">Cumplido</span>}
                          {cerca && <span className="ml-auto text-accent font-semibold uppercase tracking-wider text-[10px]">A punto</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className={cn(
                'mt-3 pt-3 border-t border-border/40 text-[11px] font-semibold flex items-center justify-between',
                c.accent,
              )}>
                <span>Administrar objetivos</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ========================== MODAL OBJETIVOS POR CATEGORIA ========================== */}
      {modalCat && (() => {
        const cat = CATEGORIAS.find(x => x.key === modalCat)!;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadein"
            onClick={closeModal}
            role="dialog" aria-modal="true" aria-label={`Objetivos de ${cat.label}`}
          >
            <div
              className={cn('relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-1 border-2 shadow-2xl', cat.ring)}
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-surface-1/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn('p-2 rounded-lg', cat.iconBg)}><cat.icon className="w-5 h-5" /></div>
                  <div>
                    <h3 className={cn('font-display text-xl font-bold', cat.accent)}>Objetivos · {cat.label}</h3>
                    <p className="text-[11px] text-text-muted">{objetivosPorCat[modalCat].length} objetivo{objetivosPorCat[modalCat].length === 1 ? '' : 's'} · {nombreMes}</p>
                  </div>
                </div>
                <button
                  type="button" onClick={closeModal}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5">
                {/* Form */}
                <form onSubmit={submitObjetivo} className="grid grid-cols-12 gap-2 mb-4">
                  <input
                    autoFocus
                    value={objTitulo}
                    onChange={e => setObjTitulo(e.target.value)}
                    placeholder={`Ej. Cerrar ${cat.label.toLowerCase()} en zona Patagonia`}
                    className="col-span-12 sm:col-span-7 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-current text-text placeholder:text-text-muted"
                  />
                  <input
                    type="number" min="1"
                    value={objMeta}
                    onChange={e => setObjMeta(e.target.value)}
                    placeholder="Meta"
                    className="col-span-4 sm:col-span-2 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-current text-text placeholder:text-text-muted"
                  />
                  <select
                    value={objUnidad}
                    onChange={e => setObjUnidad(e.target.value)}
                    className="col-span-5 sm:col-span-2 bg-surface-2 border border-border rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:border-current text-text"
                  >
                    <option value="ventas">ventas</option>
                    <option value="alquileres">alquileres</option>
                    <option value="clientes">clientes</option>
                    <option value="visitas">visitas</option>
                    <option value="captaciones">captaciones</option>
                    <option value="llamadas">llamadas</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!objTitulo.trim() || !objMeta}
                    className={cn(
                      'col-span-3 sm:col-span-1 inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all',
                      cat.iconBg,
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>

                {objetivosPorCat[modalCat].length === 0 ? (
                  <div className="text-center py-10 text-text-muted">
                    <cat.icon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin objetivos de {cat.label.toLowerCase()} este mes.</p>
                    <p className="text-[11px] mt-1">Escribí uno arriba y presioná +</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {objetivosPorCat[modalCat].map(o => {
                      const pct = o.meta > 0 ? Math.min(100, Math.round((o.actual / o.meta) * 100)) : 0;
                      const done = pct >= 100;
                      const cerca = pct >= 70 && !done;
                      return (
                        <li key={o.id} className={cn(
                          'p-3 rounded-lg border',
                          done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-surface-2/50',
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                              'shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold',
                              done ? 'bg-emerald-500/20 text-emerald-300' : cat.iconBg,
                            )}>{pct}%</span>
                            <span className="text-sm text-text flex-1 min-w-0 font-medium break-words leading-tight">{o.titulo}</span>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm('Eliminar objetivo?')) eliminarObjetivo(o.id); }}
                              className="shrink-0 p-1.5 text-text-muted hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="relative w-full h-2.5 bg-surface-2 rounded-full overflow-hidden mb-2">
                            <div
                              className={cn('h-full rounded-full transition-all duration-700 ease-out', done ? 'bg-emerald-400' : cat.bar)}
                              style={{ width: `${pct}%` }}
                            />
                            {cerca && (
                              <div
                                className="absolute inset-y-0 left-0 shimmer-bar rounded-full pointer-events-none"
                                style={{ width: `${pct}%` }}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <label className="text-[11px]">Actual:</label>
                            <input
                              type="number" min="0"
                              value={o.actual}
                              onChange={e => actualizarObjetivo(o.id, { actual: Number(e.target.value) || 0 })}
                              className="w-20 bg-surface-2 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-current text-text"
                              aria-label="Cantidad actual"
                            />
                            <span>/ {o.meta} {o.unidad}</span>
                            {done && <span className="ml-auto text-emerald-300 font-semibold uppercase tracking-wider text-[10px]">Cumplido</span>}
                            {cerca && <span className="ml-auto text-accent font-semibold uppercase tracking-wider text-[10px]">A punto</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================== EQUIPO + TAREAS ========================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Leaderboard */}
        <Card className="lg:col-span-7 border-accent/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/15 text-accent"><Trophy className="w-4 h-4" /></div>
              <h3 className="font-display text-base font-semibold text-text">Equipo destacado del mes</h3>
            </div>
            <Link to="/empleados" className="text-xs text-accent hover:underline flex items-center gap-1">
              Ver equipo <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {topEquipo.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Sin actividad cargada este mes.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {topEquipo.map(({ e, score }, idx) => {
                const podio = idx === 0;
                const segundo = idx === 1;
                const tercero = idx === 2;
                const MedallaIcon = podio ? Trophy : segundo ? Medal : tercero ? Award : null;
                return (
                  <li key={e.empleado_id} className="list-none">
                    <Link
                      to={`/empleados?focus=${encodeURIComponent(e.empleado_id)}`}
                      aria-label={`Ver perfil de ${e.nombre}`}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all group',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
                        podio
                          ? 'border-accent/40 bg-gradient-to-r from-accent/8 to-transparent halo-gold hover:from-accent/15'
                          : segundo
                            ? 'border-zinc-400/30 bg-zinc-400/5 hover:border-zinc-400/50'
                            : tercero
                              ? 'border-orange-400/30 bg-orange-400/5 hover:border-orange-400/50'
                              : 'border-border bg-surface-1 hover:border-accent/30',
                      )}
                    >
                      <span className={cn(
                        'shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-display text-sm font-bold',
                        podio ? 'bg-accent text-accent-fg shadow-gold' :
                        segundo ? 'bg-zinc-400/20 text-zinc-200' :
                        tercero ? 'bg-orange-400/20 text-orange-300' :
                        'bg-surface-2 text-text-muted',
                      )}>
                        {MedallaIcon ? <MedallaIcon className="w-4 h-4" /> : `#${idx + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium text-text truncate group-hover:text-accent transition-colors">{e.nombre}</span>
                          {e.rol && <span className="text-[10px] uppercase tracking-wider text-text-subtle">{e.rol}</span>}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          <span className="text-emerald-300 font-semibold">{e.cierres_mes || 0}</span> cierres ·
                          <span className="text-blue-300 font-semibold"> {e.visitas_mes || 0}</span> visitas
                        </div>
                      </div>
                      <div className="shrink-0 text-right flex items-center gap-2">
                        <div>
                          <div className={cn('font-display text-xl font-bold leading-none tabular-nums', podio ? 'text-accent' : 'text-text')}>
                            {score}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-text-subtle">pts</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t border-border/40 text-[11px] text-text-subtle">
            Score = <span className="text-emerald-300 font-semibold">cierres × 3</span> + <span className="text-blue-300 font-semibold">visitas × 1</span>
          </div>
        </Card>

        {/* Tareas del dia */}
        <Card className="lg:col-span-5 border-accent/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/15 text-accent"><ListTodo className="w-4 h-4" /></div>
              <h3 className="font-display text-base font-semibold text-text">Tareas de hoy</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
                {tareasDelDia.length}
              </span>
            </div>
            <Link to="/marketing" className="text-xs text-accent hover:underline flex items-center gap-1" title="Administrar todas las tareas en el panel WESEKA.IA">
              Administrar <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <form onSubmit={submitQuickTarea} className="flex gap-2 mb-3">
            <input
              value={qTarea}
              onChange={e => setQTarea(e.target.value)}
              placeholder="Tarea para HOY (Enter)..."
              className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
            />
            <button
              type="submit" disabled={!qTarea.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Agregar"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>

          {tareasDelDia.length === 0 ? (
            <div className="text-center py-6 text-text-muted">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Sin tareas con vencimiento para hoy.</p>
              {tareasSinFecha.length > 0 && (
                <p className="text-[10px] mt-1 text-text-subtle">
                  Hay {tareasSinFecha.length} sin fecha. <Link to="/marketing" className="underline">Administrar en WESEKA.IA</Link>
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {tareasDelDia.map(t => {
                const d = parseDateLocal(t.vencimiento);
                const vencida = d ? d < hoy : false;
                return (
                  <li key={t.id} className={cn(
                    'flex items-center gap-2 p-2 rounded-md border transition-colors group',
                    vencida ? 'border-rose-500/30 bg-rose-500/5' : 'border-border bg-surface-1 hover:border-accent/40',
                  )}>
                    <button
                      type="button"
                      onClick={() => actualizarTarea(t.id, { estado: 'completada', completada_en: new Date().toISOString() })}
                      className="shrink-0 text-text-muted hover:text-accent transition-colors"
                      aria-label="Completar"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', prioDot[t.prioridad])} />
                    <span className="text-sm text-text flex-1 min-w-0 break-words">{t.titulo}</span>
                    {vencida && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-300 font-semibold shrink-0">
                        <AlertTriangle className="w-3 h-3" /> VENC
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => actualizarTarea(t.id, { asignado_a: MARKETING_ASIGNADO_ID })}
                      className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/20 transition-colors opacity-0 group-hover:opacity-100 inline-flex items-center gap-1"
                      title="Derivar al equipo WESEKA.IA"
                    >
                      WSK
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

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

      <div className="mt-6 text-[11px] text-text-subtle text-center">
        Tareas y datos del equipo · administración tabular en el panel <Link to="/marketing" className="text-accent hover:underline">WESEKA.IA</Link>
      </div>
    </>
  );
}
