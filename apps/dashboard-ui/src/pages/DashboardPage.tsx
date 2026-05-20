import { useMetrics } from '@/hooks/useMetrics';
import { StatCard } from '@/components/charts/StatCard';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, Home, Calendar, Clock, Sparkles, AlertCircle, TrendingUp, MessageSquare } from 'lucide-react';

export function DashboardPage() {
  const { data, isLoading, error } = useMetrics();

  if (isLoading) return <div className="text-text-muted">Cargando métricas...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const { kpis, charts } = data;
  const horas = Math.round(kpis.tiempoAhorradoTotalMin / 60);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen ejecutivo · datos en vivo desde el Sheet" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Leads total" value={kpis.leadsTotal} icon={Users} accent="blue" />
        <StatCard label="Leads hoy" value={kpis.leadsHoy} icon={TrendingUp} accent="green" />
        <StatCard label="Calificados (≥70)" value={kpis.leadsCalificados} icon={Sparkles} accent="pink" />
        <StatCard label="Visitas agendadas" value={kpis.visitasAgendadas} icon={Calendar} accent="green" />
        <StatCard label="Propiedades activas" value={kpis.propiedadesActivas} icon={Home} accent="amber" />
        <StatCard label="Matches pendientes" value={kpis.matchesPendientes} icon={AlertCircle} accent="amber" />
        <StatCard
          label="Acciones IA (7d)"
          value={kpis.accionesIaUltimaSemana}
          icon={MessageSquare}
          accent="blue"
        />
        <StatCard
          label="Tiempo ahorrado"
          value={`${horas}h`}
          hint={`${kpis.tiempoAhorradoTotalMin} min totales`}
          icon={Clock}
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <BarChartCard
          title="Leads por etapa"
          data={charts.leadsPorEtapa}
          xKey="etapa"
          yKey="count"
        />
        <BarChartCard
          title="Leads por zona"
          data={charts.leadsPorZona}
          xKey="zona"
          yKey="count"
          color="#3b82f6"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChartCard
          title="Mensajes por día (últimos 14 días)"
          data={charts.mensajesPorDia}
          xKey="fecha"
          yKey="count"
        />
        <BarChartCard
          title="Acciones por agente"
          data={charts.accionesPorAgente}
          xKey="agente"
          yKey="count"
          color="#ec4899"
        />
      </div>
    </>
  );
}
