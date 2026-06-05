import { useMetrics } from '@/hooks/useMetrics';
import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { useEmpleados } from '@/hooks/useEmpleados';
import { useTareas, type TareaPrioridad } from '@/hooks/useTareas';
import { useObjetivosMes, usePuntosMejora, type PuntoMejora, type ObjetivoCategoria } from '@/hooks/useMarketingLocal';
import { StatCard } from '@/components/charts/StatCard';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Home, Calendar, TrendingUp, MessageSquare,
  ShoppingCart, Phone, ArrowUpRight, Target, ListTodo, Lightbulb,
  Plus, Trash2, AlertTriangle, CheckSquare, Square, Megaphone,
  Trophy, Medal, Award, Sparkles, Building2, Key, UserPlus,
} from 'lucide-react';
import type { Lead, Propiedad, Empleado } from '@/types/domain';
import { cn } from '@/lib/utils';

const isVenta = (op?: string) => /vent|sale|compra/i.test(String(op || ''));
const isAlquiler = (op?: string) => /alquil|rent/i.test(String(op || ''));

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

// Sentinela: tarea derivada al equipo de Marketing (WSK).
export const MARKETING_ASIGNADO_ID = 'marketing_wsk';

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

export function DashboardPage() {
  const { data: metrics } = useMetrics();
  const { data: leads = [] } = useLeads();
  const { data: props = [] } = usePropiedades();
  const { data: empleados = [] } = useEmpleados();
  const { tareas, crear: crearTarea, actualizar: actualizarTarea } = useTareas();
  const { objetivos, crear: crearObjetivo, actualizar: actualizarObjetivo, eliminar: eliminarObjetivo } = useObjetivosMes();
  const { puntos, crear: crearPunto, actualizar: actualizarPunto, eliminar: eliminarPunto } = usePuntosMejora();

  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const stats = useMemo(() => {
    const lv = leads.filter((l: Lead) => isVenta(l.operacion));
    const la = leads.filter((l: Lead) => isAlquiler(l.operacion));
    const pv = props.filter((p: Propiedad) => isVenta(p.operacion));
    const pa = props.filter((p: Propiedad) => isAlquiler(p.operacion));
    const solicVisita = leads.filter(l => String(l.etapa||'').toLowerCase().replace(/[\s_]/g,'') === 'solicitovisita').length;
    return {
      lv: lv.length, la: la.length,
      pv: pv.length, pa: pa.length,
      solicVisita,
    };
  }, [leads, props]);

  // Equipo activo + leaderboard por (cierres + visitas)
  const topEquipo = useMemo(() => {
    return [...empleados]
      .filter((e: Empleado) => e.activo !== false)
      .map((e: Empleado) => ({
        e,
        score: (e.cierres_mes || 0) * 3 + (e.visitas_mes || 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [empleados]);

  const totales = useMemo(() => {
    const cierres = empleados.reduce((s, e) => s + (e.cierres_mes || 0), 0);
    const visitas = empleados.reduce((s, e) => s + (e.visitas_mes || 0), 0);
    return { cierres, visitas };
  }, [empleados]);

  // Tareas del equipo Bochile (no derivadas a marketing)
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

  // Form objetivo (categoria seleccionable)
  const [objCat, setObjCat] = useState<ObjetivoCategoria>('ventas');
  const [objTitulo, setObjTitulo] = useState('');
  const [objMeta, setObjMeta] = useState('');
  const [objUnidad, setObjUnidad] = useState('ventas');

  function submitObjetivo(e: React.FormEvent) {
    e.preventDefault();
    if (!objTitulo.trim() || !objMeta) return;
    crearObjetivo({ titulo: objTitulo.trim(), meta: Number(objMeta), unidad: objUnidad, categoria: objCat });
    setObjTitulo(''); setObjMeta('');
  }

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

  if (!metrics) return <div className="text-text-muted">Cargando...</div>;
  const { kpis, charts } = metrics;
  const nombreMes = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // KPI estrella = cierres del mes (la cifra mas motivacional)
  const heroKpi = totales.cierres;
  const heroSubKpi = totales.visitas;

  return (
    <>
      {/* ========================== HERO MOTIVACIONAL ========================== */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-surface-1 via-surface-0 to-surface-0">
        {/* glows decorativos */}
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
                <span className="text-emerald-300 font-semibold">{heroSubKpi}</span> visitas concretadas · <span className="text-accent font-semibold">{kpis.visitasAgendadas}</span> agendadas
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================== KPIs OPERATIVOS ========================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard label="Clientes total" value={kpis.leadsTotal} icon={Users} accent="blue" to="/leads" />
        <StatCard label="Clientes nuevos hoy" value={kpis.leadsHoy} icon={TrendingUp} accent="green" to="/leads" />
        <StatCard label="Quieren visitar" value={stats.solicVisita} hint="Pendientes" icon={Phone} accent="amber" to="/visitas" />
        <StatCard label="Visitas agendadas" value={kpis.visitasAgendadas} icon={Calendar} accent="pink" to="/visitas" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Propiedades publicadas" value={kpis.propiedadesActivas ?? 0} icon={Home} accent="gold" to="/propiedades" />
        <StatCard label="Clientes en venta" value={stats.lv} icon={ShoppingCart} accent="green" to="/leads" />
        <StatCard label="Propiedades en venta" value={stats.pv} icon={Home} accent="blue" to="/propiedades" />
        <StatCard label="Mensajes (7d)" value={kpis.accionesIaUltimaSemana} icon={MessageSquare} accent="amber" to="/conversaciones" />
      </div>

      {/* ========================== OBJETIVOS POR AREA ========================== */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/15 text-accent"><Target className="w-4 h-4" /></div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-text">Objetivos de {nombreMes}</h2>
          </div>
          <span className="text-[11px] text-text-subtle">Editá la cifra <em>actual</em> a medida que cumplas</span>
        </div>

        {/* Form nuevo objetivo */}
        <Card className="mb-3 border-accent/30">
          <form onSubmit={submitObjetivo} className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-3 flex gap-1">
              {CATEGORIAS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setObjCat(c.key)}
                  className={cn(
                    'flex-1 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all border inline-flex items-center justify-center gap-1',
                    objCat === c.key ? `${c.iconBg} ${c.ring}` : 'bg-surface-2 border-border text-text-muted hover:text-text',
                  )}
                >
                  <c.icon className="w-3 h-3" /> {c.label}
                </button>
              ))}
            </div>
            <input
              value={objTitulo}
              onChange={e => setObjTitulo(e.target.value)}
              placeholder="Ej. Cerrar ventas en zona Patagonia"
              className="col-span-12 sm:col-span-4 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
            />
            <input
              type="number" min="1"
              value={objMeta}
              onChange={e => setObjMeta(e.target.value)}
              placeholder="Meta"
              className="col-span-4 sm:col-span-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
            />
            <select
              value={objUnidad}
              onChange={e => setObjUnidad(e.target.value)}
              className="col-span-5 sm:col-span-2 bg-surface-2 border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-accent text-text"
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
              className="col-span-3 sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </form>
        </Card>

        {/* 3 columnas por area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CATEGORIAS.map(c => (
            <Card key={c.key} className={cn('transition-colors', c.ring)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg', c.iconBg)}><c.icon className="w-4 h-4" /></div>
                  <h3 className={cn('font-display text-base font-semibold', c.accent)}>{c.label}</h3>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
                  {objetivosPorCat[c.key].length}
                </span>
              </div>

              {objetivosPorCat[c.key].length === 0 ? (
                <button
                  type="button"
                  onClick={() => { setObjCat(c.key); document.querySelector<HTMLInputElement>(`input[placeholder*="Cerrar"]`)?.focus(); }}
                  className="w-full text-center py-6 text-text-muted hover:text-text border border-dashed border-border rounded-lg hover:border-accent/40 transition-colors"
                >
                  <Plus className="w-5 h-5 mx-auto mb-1 opacity-50" />
                  <span className="text-xs">Sumá un objetivo de {c.label.toLowerCase()}</span>
                </button>
              ) : (
                <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {objetivosPorCat[c.key].map(o => {
                    const pct = o.meta > 0 ? Math.min(100, Math.round((o.actual / o.meta) * 100)) : 0;
                    const done = pct >= 100;
                    const cerca = pct >= 70 && !done;
                    return (
                      <li key={o.id} className={cn(
                        'p-3 rounded-lg border transition-colors',
                        done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-surface-1 hover:border-current/40',
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            'shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold',
                            done ? 'bg-emerald-500/20 text-emerald-300' : `${c.iconBg}`,
                          )}>{pct}%</span>
                          <span className="text-sm text-text flex-1 min-w-0 font-medium break-words leading-tight">{o.titulo}</span>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm('Eliminar objetivo?')) eliminarObjetivo(o.id); }}
                            className="shrink-0 p-1 text-text-muted hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="relative w-full h-2.5 bg-surface-2 rounded-full overflow-hidden mb-2">
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
                        <div className="flex items-center gap-2 text-[11px] text-text-muted">
                          <input
                            type="number" min="0"
                            value={o.actual}
                            onChange={e => actualizarObjetivo(o.id, { actual: Number(e.target.value) || 0 })}
                            className="w-16 bg-surface-2 border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-accent text-text"
                          />
                          <span>de {o.meta} {o.unidad}</span>
                          {done && <span className="ml-auto text-emerald-300 font-semibold uppercase tracking-wider text-[10px]">Cumplido</span>}
                          {cerca && <span className="ml-auto text-accent font-semibold uppercase tracking-wider text-[10px]">A punto</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ========================== EQUIPO + TAREAS DEL DIA ========================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Leaderboard equipo */}
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
                  <li
                    key={e.empleado_id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all',
                      podio
                        ? 'border-accent/40 bg-gradient-to-r from-accent/8 to-transparent halo-gold'
                        : segundo
                          ? 'border-zinc-400/30 bg-zinc-400/5'
                          : tercero
                            ? 'border-orange-400/30 bg-orange-400/5'
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
                        <span className="font-medium text-text truncate">{e.nombre}</span>
                        {e.rol && <span className="text-[10px] uppercase tracking-wider text-text-subtle">{e.rol}</span>}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        <span className="text-emerald-300 font-semibold">{e.cierres_mes || 0}</span> cierres ·
                        <span className="text-blue-300 font-semibold"> {e.visitas_mes || 0}</span> visitas
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cn('font-display text-xl font-bold leading-none', podio ? 'text-accent' : 'text-text')}>
                        {score}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-text-subtle">pts</div>
                    </div>
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
            <Link to="/tareas" className="text-xs text-accent hover:underline flex items-center gap-1">
              Todas <ArrowUpRight className="w-3 h-3" />
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
                  Hay {tareasSinFecha.length} sin fecha. <Link to="/tareas" className="underline">Ir a Tareas</Link>
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
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
                      title="Derivar al equipo de Marketing"
                    >
                      <Megaphone className="w-3 h-3" />
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
          <span className="text-[11px] text-text-subtle hidden sm:inline">Hablen entre ustedes lo que cuesta · escríbanlo acá · resuélvanlo juntos</span>
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

      {/* ========================== PANELES + CHARTS ========================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PanelLink to="/ventas" color="emerald" icon={ShoppingCart} title="Ventas" badge="Activo">
          <Row label="Clientes en venta" value={stats.lv} />
          <Row label="Propiedades en venta" value={stats.pv} />
          <Row label="Visitas agendadas" value={kpis.visitasAgendadas} />
        </PanelLink>

        <PanelLink to="/conversaciones" color="blue" icon={MessageSquare} title="Mensajes" badge="En vivo">
          <Row label="Mensajes ultimos 7 dias" value={kpis.accionesIaUltimaSemana} />
          <Row label="Quieren visitar" value={stats.solicVisita} />
          <Row label="Clientes nuevos hoy" value={kpis.leadsHoy} />
        </PanelLink>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <BarChartCard title="Clientes por etapa" data={charts.leadsPorEtapa} xKey="etapa" yKey="count" />
        <BarChartCard title="Clientes por zona" data={charts.leadsPorZona} xKey="zona" yKey="count" color="#3b82f6" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChartCard title="Mensajes por dia (ultimos 14 dias)" data={charts.mensajesPorDia} xKey="fecha" yKey="count" />
      </div>

      <div className="mt-8 p-4 rounded-xl bg-surface-1 border border-border text-center">
        <span className="text-xs text-text-muted">Bochile Inmobiliaria · Desde 1970 · Bahia Blanca</span>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="font-display font-semibold text-text">{value}</span>
    </div>
  );
}

const panelColors = {
  emerald: {
    border: 'border-emerald-500/20 hover:border-emerald-500/60',
    iconBg: 'bg-emerald-500/10 text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-300',
    glow: 'hover:shadow-[0_10px_30px_-15px_rgba(16,185,129,0.45)]',
    link: 'text-emerald-300',
  },
  blue: {
    border: 'border-blue-500/20 hover:border-blue-500/60',
    iconBg: 'bg-blue-500/10 text-blue-300',
    badge: 'bg-blue-500/10 text-blue-300',
    glow: 'hover:shadow-[0_10px_30px_-15px_rgba(59,130,246,0.45)]',
    link: 'text-blue-300',
  },
  gold: {
    border: 'border-accent/30 hover:border-accent/70',
    iconBg: 'bg-accent/10 text-accent',
    badge: 'bg-accent/10 text-accent',
    glow: 'hover:shadow-[0_10px_30px_-15px_rgba(255,200,80,0.45)]',
    link: 'text-accent',
  },
};

function PanelLink({
  to, color, icon: Icon, title, badge, children,
}: {
  to: string;
  color: keyof typeof panelColors;
  icon: any;
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  const c = panelColors[color];
  return (
    <Link
      to={to}
      className={cn(
        'card p-5 transition-all group block',
        c.border, c.glow,
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg transition-transform group-hover:scale-110', c.iconBg)}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
        </div>
        <Badge className={c.badge}>{badge}</Badge>
      </div>
      <div className="space-y-2.5">{children}</div>
      <div className={cn('mt-4 flex items-center justify-center gap-1 text-xs', c.link)}>
        <span>Ver dashboard completo</span>
        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </div>
    </Link>
  );
}
