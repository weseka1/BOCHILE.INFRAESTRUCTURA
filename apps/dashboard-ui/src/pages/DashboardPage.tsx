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
import {
  Users, Home, Calendar, Clock, Sparkles, AlertCircle, TrendingUp, MessageSquare,
  ShoppingCart, KeyRound, DollarSign, Award, Activity, Zap, Target, Phone
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
            <div className="px-4 py-3 bg-surface-2 rounded-xl border border-border min-w-[120px]">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Hoy</div>
              <div className="font-display text-2xl text-accent font-bold">{stats.accionesHoy}</div>
              <div className="text-[10px] text-text-subtle">Acciones IA</div>
            </div>
            <div className="px-4 py-3 bg-surface-2 rounded-xl border border-border min-w-[120px]">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Total</div>
              <div className="font-display text-2xl text-emerald-300 font-bold">{horas}h</div>
              <div className="text-[10px] text-text-subtle">Tiempo ahorrado</div>
            </div>
          </div>
        </div>
      </div>

      {/* GLOBAL KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Leads totales" value={kpis.leadsTotal} icon={Users} accent="blue" />
        <StatCard label="Leads hoy" value={kpis.leadsHoy} icon={TrendingUp} accent="green" />
        <StatCard label="Calificados ≥70" value={stats.calificados} icon={Sparkles} accent="pink" />
        <StatCard label="Solicitan visita" value={stats.solicVisita} hint="Pendientes humana" icon={Phone} accent="amber" />
      </div>

      {/* SPLIT 3 paneles: VENTAS / ALQUILERES / OPERACIONES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* VENTAS */}
        <Card className="border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-text">Ventas</h3>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-300">Activo</Badge>
          </div>
          <div className="space-y-2.5">
            <Row label="Leads de venta" value={stats.lv} />
            <Row label="Propiedades en venta" value={stats.pv} />
            <Row label="Calificados ≥70" value={leads.filter(l => isVenta(l.operacion) && Number(l.score||0) >= 70).length} />
          </div>
          <a href="/ventas" className="mt-4 block text-center text-xs text-emerald-300 hover:underline">Ver dashboard completo →</a>
        </Card>

        {/* ALQUILERES */}
        <Card className="border-blue-500/20 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-300">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-text">Alquileres</h3>
            </div>
            <Badge className="bg-blue-500/10 text-blue-300">Activo</Badge>
          </div>
          <div className="space-y-2.5">
            <Row label="Leads de alquiler" value={stats.la} />
            <Row label="Propiedades en alquiler" value={stats.pa} />
            <Row label="Contratos activos" value={stats.contratos} />
          </div>
          <a href="/alquileres" className="mt-4 block text-center text-xs text-blue-300 hover:underline">Ver dashboard completo →</a>
        </Card>

        {/* OPERACIONES IA */}
        <Card className="border-accent/30 hover:border-accent/60 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-text">Cami IA</h3>
            </div>
            <Badge className="bg-accent/10 text-accent">Operando</Badge>
          </div>
          <div className="space-y-2.5">
            <Row label="Acciones (7d)" value={kpis.accionesIaUltimaSemana} />
            <Row label="Visitas agendadas" value={kpis.visitasAgendadas} />
            <Row label="Matches pendientes" value={kpis.matchesPendientes} />
          </div>
          <a href="/acciones" className="mt-4 block text-center text-xs text-accent hover:underline">Ver acciones detalle →</a>
        </Card>
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
