import { useMetrics } from '@/hooks/useMetrics';
import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { useVisitas } from '@/hooks/useVisitas';
import { useContratos } from '@/hooks/useContratos';
import { useAcciones } from '@/hooks/useAcciones';
import { StatCard } from '@/components/charts/StatCard';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Home, Calendar, Clock, Sparkles, AlertCircle, TrendingUp, MessageSquare,
  ShoppingCart, KeyRound, DollarSign, Award, Activity, Zap, Target, Phone, ArrowUpRight
} from 'lucide-react';
import type { Lead, Propiedad } from '@/types/domain';
import { cn } from '@/lib/utils';

const isVenta = (op?: string) => /vent|sale|compra/i.test(String(op || ''));
const isAlquiler = (op?: string) => /alquil|rent/i.test(String(op || ''));

export function DashboardPage() {
  const { data: metrics } = useMetrics();
  const { data: leads = [] } = useLeads();
  const { data: props = [] } = usePropiedades();
  const { data: visitas = [] } = useVisitas();
  const { data: contratos = [] } = useContratos();
  const { data: acciones = [] } = useAcciones();

  const stats = useMemo(() => {
    const lv = leads.filter((l: Lead) => isVenta(l.operacion));
    const la = leads.filter((l: Lead) => isAlquiler(l.operacion));
    const pv = props.filter((p: Propiedad) => isVenta(p.operacion));
    const pa = props.filter((p: Propiedad) => isAlquiler(p.operacion));
    const solicVisita = leads.filter(l => String(l.etapa||'').toLowerCase().replace(/[\s_]/g,'') === 'solicitovisita').length;
    const calificados = leads.filter(l => Number(l.score || 0) >= 70).length;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const accionesHoy = acciones.filter((a: any) => {
      const t = new Date(a.timestamp || 0); return t >= hoy;
    }).length;
    return {
      lv: lv.length, la: la.length, pv: pv.length, pa: pa.length,
      solicVisita, calificados, accionesHoy,
      contratos: contratos.length,
      tiempoAhorrado: metrics?.kpis?.tiempoAhorradoTotalMin || 0,
    };
  }, [leads, props, contratos, acciones, metrics]);

  const horas = Math.round(stats.tiempoAhorrado / 60);

  if (!metrics) return <div className="text-text-muted">Cargando panel central...</div>;
  const { kpis, charts } = metrics;

  return (
    <>
      {/* HERO */}
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-accent/20 via-surface-1 to-surface-1 border border-accent/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-semibold">Sistema operando 24/7</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-text mb-1">
              Panel Central <span className="text-accent">Bochile</span>
            </h1>
            <p className="text-sm text-text-muted">Vista ejecutiva integral · ventas + alquileres + operaciones · datos en vivo desde el Sheet</p>
          </div>
          <div className="flex gap-2">
            <Link to="/acciones" className="px-4 py-3 bg-surface-2 rounded-xl border border-border hover:border-accent/50 hover:-translate-y-0.5 transition-all min-w-[120px] cursor-pointer group">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Hoy</div>
              <div className="font-display text-2xl text-accent font-bold">{stats.accionesHoy}</div>
              <div className="text-[10px] text-text-subtle flex items-center gap-1">Acciones IA <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
            </Link>
            <Link to="/acciones" className="px-4 py-3 bg-surface-2 rounded-xl border border-border hover:border-emerald-400/50 hover:-translate-y-0.5 transition-all min-w-[120px] cursor-pointer group">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Total</div>
              <div className="font-display text-2xl text-emerald-300 font-bold">{horas}h</div>
              <div className="text-[10px] text-text-subtle flex items-center gap-1">Tiempo ahorrado <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
            </Link>
          </div>
        </div>
      </div>

      {/* GLOBAL KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard label="Leads totales" value={kpis.leadsTotal} icon={Users} accent="blue" to="/leads" />
        <StatCard label="Leads hoy" value={kpis.leadsHoy} icon={TrendingUp} accent="green" to="/leads" />
        <StatCard label="Calificados ≥70" value={stats.calificados} icon={Sparkles} accent="pink" to="/leads?score=70" />
        <StatCard label="Solicitan visita" value={stats.solicVisita} hint="Pendientes humana" icon={Phone} accent="amber" to="/visitas" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Propiedades activas" value={kpis.propiedadesActivas ?? 0} icon={Home} accent="gold" to="/propiedades" />
        <StatCard label="Matches pendientes" value={kpis.matchesPendientes} icon={AlertCircle} accent="amber" to="/acciones" />
        <StatCard label="Acciones IA (7d)" value={kpis.accionesIaUltimaSemana} icon={MessageSquare} accent="blue" to="/acciones" />
        <StatCard label="Tiempo ahorrado" value={`${horas}h`} hint={`${stats.tiempoAhorrado} min totales`} icon={Clock} accent="green" to="/acciones" />
      </div>

      {/* SPLIT 3 paneles: VENTAS / ALQUILERES / OPERACIONES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <PanelLink to="/ventas" color="emerald" icon={ShoppingCart} title="Ventas" badge="Activo">
          <Row label="Leads de venta" value={stats.lv} />
          <Row label="Propiedades en venta" value={stats.pv} />
          <Row label="Calificados ≥70" value={leads.filter(l => isVenta(l.operacion) && Number(l.score||0) >= 70).length} />
        </PanelLink>

        <PanelLink to="/alquileres" color="blue" icon={KeyRound} title="Alquileres" badge="Activo">
          <Row label="Leads de alquiler" value={stats.la} />
          <Row label="Propiedades en alquiler" value={stats.pa} />
          <Row label="Contratos activos" value={stats.contratos} />
        </PanelLink>

        <PanelLink to="/acciones" color="gold" icon={Zap} title="Cami IA" badge="Operando">
          <Row label="Acciones (7d)" value={kpis.accionesIaUltimaSemana} />
          <Row label="Visitas agendadas" value={kpis.visitasAgendadas} />
          <Row label="Matches pendientes" value={kpis.matchesPendientes} />
        </PanelLink>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <BarChartCard title="Leads por etapa" data={charts.leadsPorEtapa} xKey="etapa" yKey="count" />
        <BarChartCard title="Leads por zona" data={charts.leadsPorZona} xKey="zona" yKey="count" color="#3b82f6" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChartCard title="Mensajes por día (últimos 14 días)" data={charts.mensajesPorDia} xKey="fecha" yKey="count" />
        <BarChartCard title="Acciones por agente" data={charts.accionesPorAgente} xKey="agente" yKey="count" color="#ec4899" />
      </div>

      {/* FOOTER */}
      <div className="mt-8 p-4 rounded-xl bg-surface-1 border border-border text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>Sistema Operativo IA · Powered by WESEKA · Camila Pomerich respondiendo en tiempo real</span>
        </div>
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
