import { useMetrics } from '@/hooks/useMetrics';
import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { StatCard } from '@/components/charts/StatCard';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeroVideo } from '@/components/layout/HeroVideo';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Home, Calendar, TrendingUp, MessageSquare,
  ShoppingCart, Phone, ArrowUpRight,
} from 'lucide-react';
import type { Lead, Propiedad } from '@/types/domain';
import { cn } from '@/lib/utils';

// Sentinela: tarea derivada al panel WESEKA.IA (antes "Marketing").
// Vive aca para que TareasPage y WesekaPage lo importen sin cycles.
export const MARKETING_ASIGNADO_ID = 'marketing_wsk';

const isVenta = (op?: string) => /vent|sale|compra/i.test(String(op || ''));

export function DashboardPage() {
  const { data: metrics } = useMetrics();
  const { data: leads = [] } = useLeads();
  const { data: props = [] } = usePropiedades();

  const stats = useMemo(() => {
    const lv = leads.filter((l: Lead) => isVenta(l.operacion));
    const pv = props.filter((p: Propiedad) => isVenta(p.operacion));
    const solicVisita = lv.filter(l => String(l.etapa||'').toLowerCase().replace(/[\s_]/g,'') === 'solicitovisita').length;
    return { lv: lv.length, pv: pv.length, solicVisita };
  }, [leads, props]);

  if (!metrics) return <div className="text-text-muted">Cargando...</div>;
  const { kpis, charts } = metrics;

  return (
    <>
      {/* HERO con metricas de negocio */}
      <HeroVideo
        title={<>Bochile <span className="text-accent">Inmobiliaria</span></>}
        tagline="DESDE 1970"
        caption="Bahia Blanca y region"
        metrics={[
          { label: 'Clientes hoy', value: kpis.leadsHoy, hint: 'Nuevos contactos', accent: 'gold', to: '/leads' },
          { label: 'Clientes total', value: kpis.leadsTotal, accent: 'blue', to: '/leads' },
          { label: 'Quieren visitar', value: stats.solicVisita, hint: 'Pendientes', accent: 'pink', to: '/visitas' },
          { label: 'Visitas agendadas', value: kpis.visitasAgendadas, accent: 'emerald', to: '/visitas' },
        ]}
      />

      {/* KPIs principales */}
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

      {/* SPLIT 2 paneles de negocio */}
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

      {/* CHARTS */}
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
