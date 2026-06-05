import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, ListTodo, Lightbulb, MessageSquare, Users, TrendingUp,
  Plus, Trash2, AlertTriangle, CheckSquare, Square, ArrowUpRight, Sparkles, Megaphone,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/charts/StatCard';
import { useLeads } from '@/hooks/useLeads';
import { useMetrics } from '@/hooks/useMetrics';
import { useTareas, type TareaPrioridad } from '@/hooks/useTareas';
import { useObjetivosMes, usePuntosMejora, type PuntoMejora } from '@/hooks/useMarketingLocal';
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

export function MarketingDashboardPage() {
  const { data: leads = [] } = useLeads();
  const { data: metrics } = useMetrics();
  const { tareas, crear: crearTarea, actualizar: actualizarTarea } = useTareas();
  const { objetivos, crear: crearObjetivo, actualizar: actualizarObjetivo, eliminar: eliminarObjetivo } = useObjetivosMes();
  const { puntos, crear: crearPunto, actualizar: actualizarPunto, eliminar: eliminarPunto } = usePuntosMejora();

  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // KPIs Marketing
  const kpis = useMemo(() => {
    const leadsHoy = metrics?.kpis.leadsHoy ?? 0;
    const leadsTotal = metrics?.kpis.leadsTotal ?? leads.length;
    const accionesIa = metrics?.kpis.accionesIaUltimaSemana ?? 0;
    // Conversion proxy: leads con etapa "Solicito Visita" / total
    const solicVisita = leads.filter(l => String(l.etapa||'').toLowerCase().replace(/[\s_]/g,'') === 'solicitovisita').length;
    const conversion = leadsTotal > 0 ? Math.round((solicVisita / leadsTotal) * 100) : 0;
    return { leadsHoy, leadsTotal, accionesIa, conversion, solicVisita };
  }, [metrics, leads]);

  // Tareas del dia (vencen hoy o estan vencidas y no completadas)
  const tareasDelDia = useMemo(() => {
    return tareas.filter(t => {
      if (t.estado === 'completada') return false;
      if (!t.vencimiento) return false;
      const d = parseDateLocal(t.vencimiento);
      if (!d) return false;
      const sameDay = d.getTime() === hoy.getTime();
      const vencida = d < hoy;
      return sameDay || vencida;
    }).sort((a, b) => {
      const da = parseDateLocal(a.vencimiento)!.getTime();
      const db = parseDateLocal(b.vencimiento)!.getTime();
      return da - db;
    });
  }, [tareas, hoy]);

  const sinVencimiento = useMemo(
    () => tareas.filter(t => t.estado !== 'completada' && !t.vencimiento).slice(0, 5),
    [tareas],
  );

  // Form objetivo
  const [objTitulo, setObjTitulo] = useState('');
  const [objMeta, setObjMeta] = useState('');
  const [objUnidad, setObjUnidad] = useState('clientes');

  function submitObjetivo(e: React.FormEvent) {
    e.preventDefault();
    if (!objTitulo.trim() || !objMeta) return;
    crearObjetivo({ titulo: objTitulo.trim(), meta: Number(objMeta), unidad: objUnidad });
    setObjTitulo(''); setObjMeta(''); setObjUnidad('clientes');
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

  // Quick add tarea del dia
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

  return (
    <>
      <PageHeader
        title="Panel Marketing"
        subtitle={`Objetivos de ${nombreMes} · tareas del dia · puntos a mejorar`}
      />

      {/* Hero KPIs marketing */}
      <div className="relative mb-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-accent/10 via-surface-1 to-fuchsia-500/5 border border-accent/30 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="w-5 h-5 text-accent" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">Equipo de Marketing</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text mb-1">
            Vamos por los objetivos de <span className="text-accent capitalize">{nombreMes}</span>
          </h2>
          <p className="text-sm text-text-muted">
            Lo que se mide se mejora. Lo que se anota se cumple. Lo que se revisa se gana.
          </p>
        </div>
      </div>

      {/* KPIs marketing principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Clientes nuevos hoy" value={kpis.leadsHoy} icon={TrendingUp} accent="green" to="/leads" />
        <StatCard label="Clientes totales" value={kpis.leadsTotal} icon={Users} accent="blue" to="/leads" />
        <StatCard label="Mensajes 7 dias" value={kpis.accionesIa} icon={MessageSquare} accent="amber" to="/conversaciones" />
        <StatCard label="Tasa solicita visita" value={`${kpis.conversion}%`} hint={`${kpis.solicVisita} de ${kpis.leadsTotal}`} icon={Sparkles} accent="pink" />
      </div>

      {/* Split: Objetivos + Tareas del dia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* OBJETIVOS DEL MES */}
        <Card className="border-accent/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/10 text-accent"><Target className="w-4 h-4" /></div>
              <h3 className="font-display text-base font-semibold text-text">Objetivos del mes</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
                {objetivos.length}
              </span>
            </div>
          </div>

          <form onSubmit={submitObjetivo} className="grid grid-cols-12 gap-2 mb-3">
            <input
              value={objTitulo}
              onChange={e => setObjTitulo(e.target.value)}
              placeholder="Ej. Cerrar ventas en zona Patagonia"
              className="col-span-12 sm:col-span-6 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
            />
            <input
              type="number" min="1"
              value={objMeta}
              onChange={e => setObjMeta(e.target.value)}
              placeholder="Meta"
              className="col-span-4 sm:col-span-2 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
            />
            <select
              value={objUnidad}
              onChange={e => setObjUnidad(e.target.value)}
              className="col-span-5 sm:col-span-2 bg-surface-2 border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-accent text-text"
            >
              <option value="clientes">clientes</option>
              <option value="visitas">visitas</option>
              <option value="ventas">ventas</option>
              <option value="alquileres">alquileres</option>
              <option value="mensajes">mensajes</option>
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

          {objetivos.length === 0 ? (
            <div className="text-center py-6 text-text-muted">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Sumá el primer objetivo del mes.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {objetivos.map(o => {
                const pct = o.meta > 0 ? Math.min(100, Math.round((o.actual / o.meta) * 100)) : 0;
                const done = pct >= 100;
                return (
                  <li key={o.id} className={cn(
                    'p-3 rounded-lg border transition-colors',
                    done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-surface-1 hover:border-accent/40',
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn(
                        'shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold',
                        done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-accent/15 text-accent',
                      )}>{pct}%</span>
                      <span className="text-sm text-text flex-1 min-w-0 font-medium break-words">{o.titulo}</span>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm('Eliminar objetivo?')) eliminarObjetivo(o.id); }}
                        className="shrink-0 p-1 text-text-muted hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden mb-2">
                      <div
                        className={cn('h-full rounded-full transition-all', done ? 'bg-emerald-400' : 'bg-accent')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                      <input
                        type="number" min="0"
                        value={o.actual}
                        onChange={e => actualizarObjetivo(o.id, { actual: Number(e.target.value) || 0 })}
                        className="w-16 bg-surface-2 border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-accent text-text"
                      />
                      <span>de {o.meta} {o.unidad}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* TAREAS DEL DIA */}
        <Card className="border-accent/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/10 text-accent"><ListTodo className="w-4 h-4" /></div>
              <h3 className="font-display text-base font-semibold text-text">Tareas del dia</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
                {tareasDelDia.length}
              </span>
            </div>
            <Link to="/marketing/tareas" className="text-xs text-accent hover:underline flex items-center gap-1">
              Todas <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <form onSubmit={submitQuickTarea} className="flex gap-2 mb-3">
            <input
              value={qTarea}
              onChange={e => setQTarea(e.target.value)}
              placeholder="Tarea para HOY (Enter para agregar)..."
              className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
            />
            <button
              type="submit" disabled={!qTarea.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>

          {tareasDelDia.length === 0 ? (
            <div className="text-center py-6 text-text-muted">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Sin tareas con vencimiento para hoy.</p>
              {sinVencimiento.length > 0 && (
                <p className="text-[10px] mt-1 text-text-subtle">
                  Hay {sinVencimiento.length} pendiente{sinVencimiento.length > 1 ? 's' : ''} sin fecha — asignales una en /marketing/tareas.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {tareasDelDia.map(t => {
                const d = parseDateLocal(t.vencimiento);
                const vencida = d ? d < hoy : false;
                return (
                  <li key={t.id} className={cn(
                    'flex items-center gap-2 p-2 rounded-md border transition-colors',
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
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* PUNTOS A MEJORAR */}
      <Card className="mb-4 border-accent/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/10 text-accent"><Lightbulb className="w-4 h-4" /></div>
            <h3 className="font-display text-base font-semibold text-text">Puntos a mejorar</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle font-mono">
              {puntos.filter(p => p.estado !== 'resuelto').length} abiertos
            </span>
          </div>
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
        Panel Marketing · Objetivos y Puntos se guardan en este navegador · las Tareas se sincronizan con el equipo
      </div>
    </>
  );
}
